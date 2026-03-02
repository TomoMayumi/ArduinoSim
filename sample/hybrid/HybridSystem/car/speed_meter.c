/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：speed_meter.c                           *
 *  内容：     スピードメータ                           *
 *  日付：     2019/06/14                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#include "speed_meter.h"

#include "drivers/output_led7seg.h"

enum {
    en_Off = 0,
    en_On  = 1
};

/*****************************************
 define
*****************************************/

/*****************************************
 関数プロトタイプ宣言
*****************************************/
static void display(void);

/*****************************************
 変数宣言
*****************************************/
static unsigned char  state;
static unsigned short display_speed;

/*****************************************
 初期化
*****************************************/
void speed_meter_init(void)
{
    state         = en_Off;
    display_speed = 0;

    display();
}

/*****************************************
 メインタスク
*****************************************/
void speed_meter_output(void)
{
    display();
}

/*****************************************
 スピードメータ点灯
*****************************************/
void speed_meter_on(void)
{
    state = en_On;
}

/*****************************************
 スピードメータ消灯
*****************************************/
void speed_meter_off(void)
{
    state = en_Off;
}

/*****************************************
 スピード設定
*****************************************/
void speed_meter_set(unsigned char speed)
{
    display_speed = speed;
}

/*****************************************
 スピードメータ表示
*****************************************/
static void display(void)
{
    if (state == en_On) {
        led7seg_set_value(display_speed);    // 0埋め4桁でスピードを表示
        led7seg_set_number(Led7SegDigit3, 0xFF, Led7SegDotOff);      // 4桁目を消灯し、3桁にする
    } else {
        led7seg_set_number(Led7SegDigit0, 0xFF, Led7SegDotOff);
        led7seg_set_number(Led7SegDigit1, 0xFF, Led7SegDotOff);
        led7seg_set_number(Led7SegDigit2, 0xFF, Led7SegDotOff);
        led7seg_set_number(Led7SegDigit3, 0xFF, Led7SegDotOff);
    }
}