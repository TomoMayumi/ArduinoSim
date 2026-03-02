/********************************************************
 LEDデバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "output_led.h"

/*****************************************
 define
*****************************************/
#define LED_PORT_DATA_REG PORTD
#define LED_PORT_DIR_REG  DDRD
#define LED_PORT_BIT      (0b00001111)

/*****************************************
 関数プロトタイプ宣言
*****************************************/

/*****************************************
 変数宣言
*****************************************/
static LedBitPosType led_data_buf; /* LED 点灯パターン */

/*****************************************
 LED 初期化
*****************************************/
void led_init(void)
{
    led_data_buf = LED_BIT_NONE;
    LED_PORT_DATA_REG &= (~LED_PORT_BIT);
    LED_PORT_DIR_REG |= LED_PORT_BIT;
}

/*****************************************
 LED 出力更新(メインループ周期で呼び出し)
*****************************************/
void led_display(void)
{
    unsigned char port_data;
    port_data = LED_PORT_DATA_REG;
    port_data &= (~LED_PORT_BIT);
    port_data |= led_data_buf & LED_PORT_BIT;
    LED_PORT_DATA_REG = port_data;
}

/*****************************************
 LED 点灯パターン設定
*****************************************/
void led_set_data(LedBitPosType led_out)
{
    led_data_buf = led_out & LED_PORT_BIT;
}

/*****************************************
 ビット指定LED 点灯
*****************************************/
void led_set_bit(LedBitPosType target_bit)
{
    LedBitPosType data_buf;

    data_buf = led_data_buf | target_bit;
    led_data_buf = data_buf;
}

/*****************************************
 ビット指定LED 消灯
*****************************************/
void led_clear_bit(LedBitPosType target_bit)
{
    LedBitPosType data_buf;

    data_buf = led_data_buf & (~target_bit);
    led_data_buf = data_buf;
}
