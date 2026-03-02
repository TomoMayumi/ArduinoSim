/********************************************************
 AD変換デバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "input_adc.h"

/*****************************************
 define
*****************************************/
/* ADC制御レジスタ値 */

/* REFS1,REFS0 : 基準電圧選択 00(AREFピンの外部基準電圧) */
/* ADLAR : 左揃え選択 1(左揃え) */
/* MUX3～0 : A/D チャネル選択 0000(ADC0) */
#define ADC_ADMUX_INIT      (_BV(ADLAR))

#define ADC_ADMUX_MUX_BIT   (_BV(MUX3) | _BV(MUX2) | _BV(MUX1) | _BV(MUX0))

/* ADEN : A/D 許可 1(許可) */
/* ADSC : A/D 変換が始まってしまうため、開始時に設定 */
/* ADATE : A/D 変換自動起動許可 0(禁止) */
/* ADIF : A/D 変換完了割り込みフラグ 0(解除) */
/* ADIE : A/D 変換完了割り込み許可 0(禁止) */
/* ADPS2～0 : A/D 変換クロック選択 111(128分周) */
#define ADC_ADCSRA_INIT     (_BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0))
/* ADSC : 1 (A/D 変換開始) */
/* ADIF : A/D 変換完了割り込みフラグ 1(1書き込みで解除) */
#define ADC_ADCSRA_START    (ADC_ADCSRA_INIT | _BV(ADSC) | _BV(ADIF))

/* ADC5D : ADC5ﾃﾞｼﾞﾀﾙ入力禁止 (ADC5 Digital Input Disable) 1(禁止) */
/* ADC4D : ADC4ﾃﾞｼﾞﾀﾙ入力禁止 (ADC4 Digital Input Disable) 1(禁止) */
#define ADC_DIDR0_INIT      (_BV(ADC5D) | _BV(ADC4D))


/* ADキー用定義 */
#define ADC_ADKEY_CHATTERING_COUNT  (1)             /* チャタリング除去 確認回数 */
#define ADC_ADKEY_CONTINUE_COUNT    (3000 / 2)      /* キー長押し認識時間(ms/論理Ch数) */
#define ADC_BANK_SIZE               (4)             /* AD変換結果保持バッファバンク数 */

/* ADキー閾値 */
#define ADC_ADKEY_LEVEL0            (32)
#define ADC_ADKEY_LEVEL1            (96)
#define ADC_ADKEY_LEVEL2            (160)
#define ADC_ADKEY_LEVEL3            (224)

/* 可変抵抗 最大・最小値 */
#define ADC_VR_VAL_MAX              (255)
#define ADC_VR_VAL_MIN              (80)

/*****************************************
 関数プロトタイプ宣言
*****************************************/
/*  ADC driver (middle level) */
static void adc_decode(void);
static void adc_decode_adkey(AdcChannelType channel);
static void adc_decode_vr(AdcChannelType channel);
static void adc_set_nextch(void);

/*  ADC driver (low level) */
static void adc_read_data(void);
static void adc_set_nextbank(void);
static unsigned char adc_get_average(AdcChannelType channel);

/*****************************************
 定数定義
*****************************************/
/* 論理チャネルと使用機能の引き当て */
static void (* const adc_decode_func[AdcChMax])(AdcChannelType channel) = {
    &adc_decode_adkey,  /* Ch0:ADキー */
    &adc_decode_vr,     /* Ch1:可変抵抗 */
};

/* 論理チャネルと物理チャネルの引き当て */
static const unsigned char adc_phych[AdcChMax] = {
    5,  /* Ch0:ADキー */
    4   /* Ch1:可変抵抗 */
};
/*****************************************
 変数宣言
*****************************************/
static unsigned char adc_buffer[AdcChMax][ADC_BANK_SIZE];   /* AD 出力バッファ */
static unsigned char adc_channel;                           /* AD 論理チャネル */
static unsigned char adc_bank;                              /* AD結果出力バッファバンクID( 0 ～ 1 ) */
static AdcAdkeyCodeType adc_adkey_confirm;                  /* 出力用ADキー 確定情報 */
static AdcAdkeyEventType adc_event_adkey;                   /* 出力用ADキー変化イベント */

static AdcAdkeyCodeType adc_adkey_pending;                  /* ADキー チャタリング除去中情報 */
static unsigned char adc_adkey_pending_count;               /* ADキー チャタリング検出カウント */
static unsigned short adc_adkey_continue_time;              /* ADキー 長押しイベント検出カウント */

static unsigned char adc_vr_value;                          /* 出力用VR電圧 */

/*****************************************
 AD コンバータ初期設定
*****************************************/
void adc_init(void)
{
    unsigned char adch;
    unsigned char bank;

    for(adch = 0; adch < AdcChMax; adch++){
        for(bank = 0; bank < ADC_BANK_SIZE; bank++){
            adc_buffer[adch][bank] = 0;
        }
    }
    adc_channel = (AdcChMax - 1);
    adc_bank = 0;
    adc_adkey_confirm = ADC_ADKEY_INVALID;
    adc_event_adkey = AdcAdkeyEvtNone;
    adc_adkey_pending = ADC_ADKEY_INVALID;
    adc_adkey_pending_count = 0;
    adc_adkey_continue_time = 0;
    adc_vr_value = 0;

    ADMUX = ADC_ADMUX_INIT;
    ADCSRA = ADC_ADCSRA_INIT;
    DIDR0 = ADC_DIDR0_INIT;
}

/*****************************************
 AD 変換開始
*****************************************/
void adc_start(void)
{
    unsigned char admux_buf;

    /* AD変換入力端子設定(物理チャネル指定) */
    admux_buf = ADMUX & (~ADC_ADMUX_MUX_BIT);
    admux_buf |= adc_phych[adc_channel];
    ADMUX = admux_buf;

    /* AD変換開始 */
    ADCSRA = ADC_ADCSRA_START;
}

/*****************************************
 AD コンバート処理
*****************************************/
void adc_convert(void)
{
    if ((ADCSRA & _BV(ADSC)) != 0x00) {
        /* AD 変換中であれば、結果の読み出しをしない */
        return;
    }

    /* AD 変換結果をバッファに保存 */
    adc_read_data();
    /* デコード処理 */
    adc_decode();
    /* 次回AD変換対象論理チャネル更新 */
    adc_set_nextch();
    /* AD変換開始 */
    adc_start();
}


/*****************************************
 可変抵抗電圧取得
*****************************************/
unsigned char adc_get_vr(void)
{
    return adc_vr_value;
}

/*****************************************
 可変抵抗電圧(正規化)取得
*****************************************/
unsigned char adc_get_vr_nrm(void)
{
    unsigned short vr_value;

    vr_value = adc_vr_value;
    if( vr_value < adc_vr_val_min){
        vr_value = adc_vr_val_min;
    }
    if( vr_value > adc_vr_val_max){
        vr_value = adc_vr_val_max;
    }
    return (unsigned char)((vr_value-adc_vr_val_min)*255/(adc_vr_val_max-adc_vr_val_min));
}

/*****************************************
 AD キー変化イベント有無の確認
*****************************************/
AdcAdkeyEventType adc_chk_event_adkey(void)
{
    return adc_event_adkey;
}

/*****************************************
 AD キー変化イベントのクリア
*****************************************/
void adc_clr_event_adkey(void)
{
    adc_event_adkey = AdcAdkeyEvtNone;
}

/*****************************************
 AD キーコード取得
*****************************************/
AdcAdkeyCodeType adc_get_adkeycode(void)
{
    return adc_adkey_confirm;
}

/*****************************************
 ADC 結果取得
*****************************************/
unsigned char adc_get_value(AdcChannelType channel)
{
    return adc_get_average(channel);
}

/*****************************************
 AD データ読み出し
*****************************************/
static void adc_read_data(void)
{
    adc_buffer[adc_channel][adc_bank] = ADCH;
}

/*****************************************
 AD データ読み出し
*****************************************/
static void adc_decode(void)
{
    AdcChannelType channel;

    channel = adc_channel;
    adc_decode_func[channel](channel);
}

/*****************************************
 AD キーデコード
*****************************************/
static void adc_decode_adkey(AdcChannelType channel)
{
    unsigned char ad_key_level;
    AdcAdkeyCodeType keycode_latest;
    unsigned char count;

    ad_key_level = adc_buffer[channel][adc_bank];
    if (ADC_ADKEY_LEVEL3 <= ad_key_level) {
        keycode_latest = ADC_ADKEY_OFF;              /*  キーオフ */
    } else if (ADC_ADKEY_LEVEL2 < ad_key_level) {
        keycode_latest = ADC_ADKEY_3;                /*  キー3 オン */
    } else if (ADC_ADKEY_LEVEL1 < ad_key_level) {
        keycode_latest = ADC_ADKEY_2;                /*  キー2 オン */
    } else if (ADC_ADKEY_LEVEL0 < ad_key_level) {
        keycode_latest = ADC_ADKEY_1;                /*  キー1 オン */
    } else {
        keycode_latest = ADC_ADKEY_0;                /*  キー0 オン */
    }

    /*  チャタリング除去処理 */
    /* キー変化なしのまま規定時間経過したらキーの状態を確定する */
    if (adc_adkey_pending != keycode_latest) {  /* キー変化あり */
        /* チャタリング除去処理開始 */
        adc_adkey_pending = keycode_latest;
        adc_adkey_pending_count = ADC_ADKEY_CHATTERING_COUNT;
    }else{                                      /* キー変化なし */
        count = adc_adkey_pending_count;

        if (count > 0) { /*  チャタリング除去中 */
            /*  チャタリング検出カウンタを更新 */
            count--;
            adc_adkey_pending_count = count;

            if (count == 0) {       /*  チャタリング検出カウント終了 */
                /*  確定値保存 */
                adc_adkey_confirm = adc_adkey_pending;
                adc_event_adkey = AdcAdkeyEvtChange;
				if (adc_adkey_confirm != ADC_ADKEY_OFF) {
					/* ボタンを押しているなら長押し判定開始 */
	                adc_adkey_continue_time = ADC_ADKEY_CONTINUE_COUNT;
				}else{
					/* ボタンを離したなら長押し判定キャンセル */
					adc_adkey_continue_time = 0;
				}
            }
        }else{
            /*  チャタリング検出カウント終了し、さらにスイッチの変化がない場合、長押し判定 */
            if (adc_adkey_continue_time > 0) {
                adc_adkey_continue_time--;
                if (adc_adkey_continue_time == 0) {
                    /*  ADキー長押しイベント */
                    adc_adkey_confirm |= ADC_ADKEY_LONG;
                    adc_event_adkey = AdcAdkeyEvtChange;
                }
            }
        }
    }
}

/*****************************************
 VRデコード
*****************************************/
static void adc_decode_vr(AdcChannelType channel)
{
    /*  未変換 */
    adc_vr_value = adc_get_average(channel);
}

/*****************************************
 AD 論理チャネル更新
*****************************************/
static void adc_set_nextch(void)
{
    unsigned char channel;

    channel = adc_channel;
    if (channel == AdcCh0) {
        channel = AdcChMax - 1;
        adc_set_nextbank();
    } else {
        channel--;
    }

    adc_channel = channel;
}

/*****************************************
 バッファバンク ID 更新
*****************************************/
static void adc_set_nextbank(void)
{
    unsigned char bank;

    bank = adc_bank;
    if (bank == (ADC_BANK_SIZE - 1)) {
        bank = 0;
    } else {
        bank++;
    }

    adc_bank = bank;
}

/*****************************************
 論理チャネル別平均値算出
*****************************************/
static unsigned char adc_get_average(AdcChannelType channel)
{
    unsigned char bank;
    unsigned short sum;

    sum = 0;
    for (bank = 0; bank < ADC_BANK_SIZE; bank++) {
        sum += adc_buffer[channel][bank];
    }
    sum /= ADC_BANK_SIZE;

    return ((unsigned char)sum);
}
