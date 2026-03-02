/********************************************************
 7セグLEDデバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "output_led7seg.h"

/*****************************************
 define
*****************************************/
#define LED7SEG_TRUE                (1)
#define LED7SEG_FALSE               (0)

/* 7セグLEDの4桁目＋ドットを使用するかどうか (LED7SEG_FALSE:使用しない LED7SEG_TRUE:使用する) */
#define LED7SEG_USE_4DIGIT          (LED7SEG_FALSE)

/* 7セグデコードIC データ制御 接続ポート(4本) */
#define LED7SEG_PORT_IC_DATA_REG1   PORTD
#define LED7SEG_PORT_IC_DATA_REG2   PORTB
#define LED7SEG_PORT_IC_DDR_REG1    DDRD
#define LED7SEG_PORT_IC_DDR_REG2    DDRB
#define LED7SEG_PORT_IC_BIT1        (0b11000000)
#define LED7SEG_PORT_IC_BIT2        (0b00000011)

/* 7セグLED 表示桁制御 接続ポート(4本) */
#define LED7SEG_PORT_DIG_DATA_REG1  PORTB
#define LED7SEG_PORT_DIG_DATA_REG2  PORTC
#define LED7SEG_PORT_DIG_DDR_REG1   DDRB
#define LED7SEG_PORT_DIG_DDR_REG2   DDRC
#define LED7SEG_PORT_DIG_BIT1       (0b00111000)
#define LED7SEG_PORT_DIG_BIT2       (0b00000100)

/* 7セグLED ドット表示制御 接続ポート(1本) */
#define LED7SEG_PORT_DOT_DATA_REG   PORTC
#define LED7SEG_PORT_DOT_DDR_REG    DDRC
#define LED7SEG_PORT_DOT_BIT        (0b00001000)

#define LED7SEG_BLINK_OFF           (0)
#define LED7SEG_BLINK_ON            (1)

/* 点滅情報 */
typedef struct {
    Led7SegBlinkTargetType target;
    unsigned char onoff;
    unsigned short cycle;
    unsigned short active;
    unsigned short count;
} Led7SegBlinkInfoType;

/* セグメント情報(1桁分の7セグLED表示情報) */
typedef struct {
    unsigned char seg1;
    unsigned char seg2;
    unsigned char dot;
} Led7SegSegmentType;

/*****************************************
 関数プロトタイプ宣言
*****************************************/
// middle level driver（非公開）
static void led7seg_update_target_digit(void);
static void led7seg_judge_blink(Led7SegSegmentType* pOut);
static void led7seg_count_blink_interval(Led7SegBlinkInfoType* pInfo);

// low Level driver (ポートアクセス)
static void led7seg_output_digit(unsigned char digit);
static void led7seg_output_segment(Led7SegSegmentType output);

/*****************************************
 変数宣言
*****************************************/
static Led7SegSegmentType led7seg_data_buf[4];  // 表示データ(4桁)
static unsigned char led7seg_target_dig;        // ダイナミック点灯現在表示桁 3 - 0 (ダウンカウント)
static Led7SegBlinkInfoType blink_info_7seg;    // 点滅情報

static const unsigned char led7seg_digreg1_tbl[] = {     // 桁出力ビットテーブル
    0b00110000,     // 桁0
    0b00101000,     // 桁1
    0b00011000,     // 桁2
    0b00111000,     // 桁3
    0b00111000,     // 全桁OFF
};

#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
static const unsigned char led7seg_digreg2_tbl[] = {     // 桁出力ビットテーブル
    0b00000100,     // 桁0
    0b00000100,     // 桁1
    0b00000100,     // 桁2
    0b00000000,     // 桁3
    0b00000100,     // 全桁OFF
};
#endif

/*****************************************
 初期化(メインタスク前に呼び出される)
*****************************************/
void led7seg_init(void)
{
    unsigned char cnt;

    for(cnt = 0; cnt < 4; cnt++){
        led7seg_data_buf[cnt].seg1 = LED7SEG_PORT_IC_BIT1;
        led7seg_data_buf[cnt].seg2 = LED7SEG_PORT_IC_BIT2;
        led7seg_data_buf[cnt].dot = 0x00;

    }

    led7seg_target_dig = Led7SegDigit0;

    blink_info_7seg.onoff = LED7SEG_BLINK_OFF;
    blink_info_7seg.target = LED7SEG_BLINK_TARGET_NONE;
    blink_info_7seg.active = 0;
    blink_info_7seg.cycle = 0;
    blink_info_7seg.count = 0;

    LED7SEG_PORT_IC_DATA_REG1 &= (~LED7SEG_PORT_IC_BIT1);
    LED7SEG_PORT_IC_DATA_REG2 &= (~LED7SEG_PORT_IC_BIT2);
    LED7SEG_PORT_DIG_DATA_REG1 |= LED7SEG_PORT_DIG_BIT1; // 桁選択のポートは1にすると非表示なので1で初期化

    LED7SEG_PORT_IC_DDR_REG1 |= LED7SEG_PORT_IC_BIT1;
    LED7SEG_PORT_IC_DDR_REG2 |= LED7SEG_PORT_IC_BIT2;
    LED7SEG_PORT_DIG_DDR_REG1 |= LED7SEG_PORT_DIG_BIT1;

#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
    LED7SEG_PORT_DIG_DATA_REG2 |= LED7SEG_PORT_DIG_BIT2; // 桁選択のポートは1にすると非表示なので1で初期化
    LED7SEG_PORT_DOT_DATA_REG &= (~LED7SEG_PORT_DOT_BIT);

    LED7SEG_PORT_DIG_DDR_REG2 |= LED7SEG_PORT_DIG_BIT2;
    LED7SEG_PORT_DOT_DDR_REG |= LED7SEG_PORT_DOT_BIT;
#endif
}

/*****************************************
 7セグ表示(メインタスク周期で呼び出される)
*****************************************/
void led7seg_display(void)
{
    Led7SegSegmentType segment_data;
    unsigned char target_digit;

    // 表示対象桁を更新
    led7seg_update_target_digit();

    // 表示対象桁を取得
    target_digit = led7seg_target_dig;
    // 表示対象桁に表示するセグメント情報をバッファから取得
    segment_data = led7seg_data_buf[target_digit];

    // ブリンクによるセグメント情報更新
    led7seg_judge_blink(&segment_data);

    // ちらつき防止のために全桁の表示をオフ
    led7seg_output_digit(Led7SegDigitAllOff);
    // 出力ポートにセグメント情報を設定
    led7seg_output_segment(segment_data);
    // 表示桁選択ビットを更新して表示開始
    led7seg_output_digit(target_digit);
}

/*****************************************
 7セグ表示データセット（数字）
*****************************************/
void led7seg_set_number(Led7SegDigitType digit, unsigned char number, Led7SegDot dot)
{
    unsigned char dotbit;

    dotbit = 0x00;
    if (dot == Led7SegDotOn) {
        dotbit = LED7SEG_PORT_DOT_BIT;
    }

    // 7セグデータバッファに格納する
    led7seg_data_buf[digit].dot = dotbit;
    led7seg_data_buf[digit].seg1 = (number << 6) & LED7SEG_PORT_IC_BIT1;
    led7seg_data_buf[digit].seg2 = (number >> 2) & LED7SEG_PORT_IC_BIT2;
}

/*****************************************
 7セグ 10進数の数値を表示(short データ版)
*****************************************/
void led7seg_set_value(unsigned short value)
{
    led7seg_set_number(Led7SegDigit3, value / 1000, Led7SegDotOff);
    led7seg_set_number(Led7SegDigit2, (value % 1000) / 100, Led7SegDotOff);
    led7seg_set_number(Led7SegDigit1, (value % 100) / 10, Led7SegDotOff);
    led7seg_set_number(Led7SegDigit0, value % 10, Led7SegDotOff);
}

/*****************************************
 7セグ ブリンク設定
B*****************************************/
void led7seg_set_blink_duty(unsigned short duration, unsigned short active_time)
{
    if (LED7SEG_BLINK_ON == blink_info_7seg.onoff) {
        // ブリンク中の設定は無視
        return;
    }

    blink_info_7seg.cycle = duration;
    blink_info_7seg.count = duration;
    blink_info_7seg.active = active_time;
}

/*****************************************
 7セグ ブリンク対象設定
B*****************************************/
void led7seg_set_blink_target(Led7SegBlinkTargetType target)
{
    blink_info_7seg.target = target;
}

/*****************************************
 7セグ ブリンク開始
*****************************************/
void led7seg_start_blink(void)
{
    blink_info_7seg.onoff = LED7SEG_BLINK_ON;
}

/*****************************************
 7セグ ブリンク停止
*****************************************/
void led7seg_stop_blink(void)
{
    blink_info_7seg.onoff = LED7SEG_BLINK_OFF;
}

/*****************************************
 入出力機能選択ビットの更新
*****************************************/
static void led7seg_update_target_digit(void)
{
    // 現在の選択ビット情報を auto 変数に代入
    unsigned char target_dig = led7seg_target_dig;

    if (0 == target_dig) {                // 3 - 0 の間で，ダウンカウント
        target_dig = Led7SegDigit3;
    } else {
        target_dig--;
    }

    led7seg_target_dig = target_dig;        // 選択ビット情報を保存
}

/*****************************************
 7セグ ブリンク処理
*****************************************/
static void led7seg_judge_blink(Led7SegSegmentType* pOut)
{
    unsigned char target_dig;
    unsigned char target;

    if (blink_info_7seg.onoff == LED7SEG_BLINK_ON) {
        // ブリンク中のみ処理する

        if (blink_info_7seg.active <= blink_info_7seg.count) {
            target_dig = led7seg_target_dig;
            target = blink_info_7seg.target;
            if((target & (LED7SEG_BLINK_TARGET_DIG0 << target_dig)) != 0x00) {
                pOut->seg1 = LED7SEG_PORT_IC_BIT1;
                pOut->seg2 = LED7SEG_PORT_IC_BIT2;
            }
            if((target & (LED7SEG_BLINK_TARGET_DOT0 << target_dig)) != 0x00){
                pOut->dot = 0;
            }
        }

        led7seg_count_blink_interval(&blink_info_7seg);
    }
}


/*****************************************
 ブリンクカウント
*****************************************/
static void led7seg_count_blink_interval(Led7SegBlinkInfoType* pInfo)
{
    unsigned short count;

    count = pInfo->count;
    if (count == 0) {
        count = pInfo->cycle;
    } else {
        count--;
    }
    pInfo->count = count;
}

/*****************************************
 表示桁設定をポート出力
*****************************************/
static void led7seg_output_digit(unsigned char digit)
{
    unsigned char dig1;
#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
    unsigned char dig2;
#endif

    dig1 = LED7SEG_PORT_DIG_DATA_REG1;
    dig1 &= ~LED7SEG_PORT_DIG_BIT1;
    dig1 |= led7seg_digreg1_tbl[digit];
    LED7SEG_PORT_DIG_DATA_REG1 = dig1;

#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
    dig2 = LED7SEG_PORT_DIG_DATA_REG2;
    dig2 &= ~LED7SEG_PORT_DIG_BIT2;
    dig2 |= led7seg_digreg2_tbl[digit];
    LED7SEG_PORT_DIG_DATA_REG2 = dig2;
#endif

}

/*****************************************
 セグメント出力をポートに設定
*****************************************/
static void led7seg_output_segment(Led7SegSegmentType output)
{
    unsigned char seg1;
    unsigned char seg2;
#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
    unsigned char dot;
#endif

    seg1 = LED7SEG_PORT_IC_DATA_REG1;
    seg1 &= ~LED7SEG_PORT_IC_BIT1;
    seg1 |= output.seg1;
    LED7SEG_PORT_IC_DATA_REG1 = seg1;

    seg2 = LED7SEG_PORT_IC_DATA_REG2;
    seg2 &= ~LED7SEG_PORT_IC_BIT2;
    seg2 |= output.seg2;
    LED7SEG_PORT_IC_DATA_REG2 = seg2;

#if (LED7SEG_USE_4DIGIT == LED7SEG_TRUE)
    dot = LED7SEG_PORT_DOT_DATA_REG;
    dot &= ~LED7SEG_PORT_DOT_BIT;
    dot |= output.dot;
    LED7SEG_PORT_DOT_DATA_REG = dot;
#endif
}

