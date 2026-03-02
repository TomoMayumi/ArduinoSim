/********************************************************
 7セグLEDデバイスドライバ
 *******************************************************/
#ifndef OUTPUT_LED7SEG_H
#define OUTPUT_LED7SEG_H

/*****************************************
 マクロ定数
*****************************************/
/* 点滅対象 */
#define LED7SEG_BLINK_TARGET_NONE (0b00000000)    /* 点滅対象：なし */
#define LED7SEG_BLINK_TARGET_DIG0 (0b00000001)    /* 点滅対象：桁0 */
#define LED7SEG_BLINK_TARGET_DIG1 (0b00000010)    /* 点滅対象：桁1 */
#define LED7SEG_BLINK_TARGET_DIG2 (0b00000100)    /* 点滅対象：桁2 */
#define LED7SEG_BLINK_TARGET_DIG3 (0b00001000)    /* 点滅対象：桁3 */
#define LED7SEG_BLINK_TARGET_DOT0 (0b00010000)    /* 点滅対象：ドット0 */
#define LED7SEG_BLINK_TARGET_DOT1 (0b00100000)    /* 点滅対象：ドット1 */
#define LED7SEG_BLINK_TARGET_DOT2 (0b01000000)    /* 点滅対象：ドット2 */
#define LED7SEG_BLINK_TARGET_DOT3 (0b10000000)    /* 点滅対象：ドット3 */
#define LED7SEG_BLINK_TARGET_ALL  (0b11111111)    /* 点滅対象：全桁＋全ドット */

/*****************************************
 型
*****************************************/
/* 点滅対象 */
typedef unsigned char Led7SegBlinkTargetType;

/* 表示桁 */
typedef enum {
    Led7SegDigit0,      /* 7セグ 桁0 */
    Led7SegDigit1,      /* 7セグ 桁1 */
    Led7SegDigit2,      /* 7セグ 桁2 */
    Led7SegDigit3,      /* 7セグ 桁3 */
    Led7SegDigitAllOff, /* 7セグ 全桁表示なし(ユニット内部用) */
} Led7SegDigitType;

/* ドット表示 */
typedef enum {
    Led7SegDotOff,  /* 7セグ ドット表示オフ */
    Led7SegDotOn    /* 7セグ ドット表示オン */
} Led7SegDot;

/*****************************************
 関数
*****************************************/
extern void led7seg_init(void);                                                                 /* 7セグLED初期化 */
extern void led7seg_display(void);                                                              /* 7セグLED出力更新 */
extern void led7seg_set_number(Led7SegDigitType digit, unsigned char number, Led7SegDot dot);   /* 7セグLED表示設定(桁指定) */
extern void led7seg_set_value(unsigned short value);                                            /* 7セグLED表示設定(4桁) */
extern void led7seg_set_blink_duty(unsigned short duration, unsigned short active_time);        /* 7セグLED点滅時間設定 */
extern void led7seg_set_blink_target(Led7SegBlinkTargetType target);                            /* 7セグLED点滅対象設定 */
extern void led7seg_start_blink(void);                                                          /* 7セグLED点滅開始 */
extern void led7seg_stop_blink(void);                                                           /* 7セグLED点滅停止 */

#endif /* OUTPUT_LED7SEG_H */
