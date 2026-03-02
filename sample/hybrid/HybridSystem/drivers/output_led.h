/********************************************************
 LEDデバイスドライバ
 *******************************************************/
#ifndef OUTPUT_LED_H
#define OUTPUT_LED_H

/*****************************************
 マクロ定数
*****************************************/
/* LEDビット位置 */
typedef unsigned char LedBitPosType;

/*****************************************
 型
*****************************************/
/* LEDビット位置 */
#define LED_BIT_NONE (0b00000000) /* なし */
#define LED_BIT_POS0 (0b00000001) /* LEDポジション0(LED1) */
#define LED_BIT_POS1 (0b00000010) /* LEDポジション1(LED2) */
#define LED_BIT_POS2 (0b00000100) /* LEDポジション2(LED3) */
#define LED_BIT_POS3 (0b00001000) /* LEDポジション3(LED4) */
#define LED_BIT_POS4 (0b00010000) /* LEDポジション4 */
#define LED_BIT_POS5 (0b00100000) /* LEDポジション5 */
#define LED_BIT_POS6 (0b01000000) /* LEDポジション6 */
#define LED_BIT_POS7 (0b10000000) /* LEDポジション7 */

/*****************************************
 関数
*****************************************/
extern void led_init(void);                             /* LED初期化 */
extern void led_display(void);                          /* LED出力更新 */
extern void led_set_data(LedBitPosType led_out);        /* LED点灯パターン設定 */
extern void led_set_bit(LedBitPosType target_bit);      /* ビット指定LED点灯 */
extern void led_clear_bit(LedBitPosType target_bit);    /* ビット指定LED消灯 */

#endif /* OUTPUT_LED_H */
