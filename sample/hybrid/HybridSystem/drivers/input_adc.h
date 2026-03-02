/********************************************************
 AD変換デバイスドライバ
 *******************************************************/
#ifndef INPUT_ADC_H
#define INPUT_ADC_H

/*****************************************
 マクロ定数
*****************************************/
/* ADキーコード */
#define ADC_ADKEY_INVALID (0b00000000) /* ADキー無効 */
#define ADC_ADKEY_OFF     (0b00000001) /* ADキーオフ */
#define ADC_ADKEY_0       (0b00000010) /* ADキー0(タクトSW4)オン */
#define ADC_ADKEY_1       (0b00000100) /* ADキー1(タクトSW3)オン */
#define ADC_ADKEY_2       (0b00001000) /* ADキー2(タクトSW2)オン */
#define ADC_ADKEY_3       (0b00010000) /* ADキー3(タクトSW1)オン */
#define ADC_ADKEY_LONG    (0b10000000) /* ADキー長押し */

/*****************************************
 型
*****************************************/
/* AD変換論理チャネル定義 */
typedef enum {
    AdcCh0,  /* CH0：ADキー */
    AdcCh1,  /* CH1：可変抵抗 */
    AdcChMax
} AdcChannelType;

/* ADキーイベント */
typedef enum {
    AdcAdkeyEvtNone,  /* イベントなし */
    AdcAdkeyEvtChange /* 変化イベントあり */
} AdcAdkeyEventType;

/* ADキーコード */
typedef unsigned char AdcAdkeyCodeType;

/*****************************************
 定数
*****************************************/
extern const unsigned char adc_vr_val_max; /* 可変抵抗によるAD変換値の最大値 */
extern const unsigned char adc_vr_val_min; /* 可変抵抗によるAD変換値の最小値 */

/*****************************************
 関数
*****************************************/
extern void adc_init(void);                                 /* AD変換初期化 */
extern void adc_start(void);                                /* AD変換開始 */
extern void adc_convert(void);                              /* AD変換実施 */
extern unsigned char adc_get_vr(void);                      /* 可変抵抗電圧取得 */
extern unsigned char adc_get_vr_nrm(void);                  /* 可変抵抗電圧(正規化)取得 */
extern AdcAdkeyEventType adc_chk_event_adkey(void);         /* ADキー変化イベント有無の確認 */
extern void adc_clr_event_adkey(void);                      /* ADキー変化イベントクリア */
extern AdcAdkeyCodeType adc_get_adkeycode(void);            /* ADキーコード取得 */
extern unsigned char adc_get_value(AdcChannelType channel); /* AD変換値取得(論理チャネル指定) */

#endif /* INPUT_ADC_H */
