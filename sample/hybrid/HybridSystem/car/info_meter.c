/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：info_meter.c                            *
 *  内容：     インフォメータ                           *
 *  日付：     2019/06/14                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#include "info_meter.h"

#include "car/shift_position.h"
#include "drivers/output_lcd.h"

/*****************************************
 define
*****************************************/
#define MAX_READY_LEN (5)
#define MAX_MODE_LEN (5)
#define MAX_SHIFT_LEN (1)

enum {
    en_Off = 0,
    en_On  = 1
};

/*****************************************
 関数プロトタイプ宣言
*****************************************/
static void display(void);
static void str_copy(const char *src, char *dst);

/*****************************************
 変数宣言
*****************************************/
static unsigned char display_state;
static char ready_str[MAX_READY_LEN + 1];
static char mode_str[MAX_MODE_LEN + 1];
static char shift_str[MAX_SHIFT_LEN + 1];

/*****************************************
 初期化
*****************************************/
void info_meter_init(void)
{
    display_state = en_Off;
    str_copy("", ready_str);
    str_copy("", mode_str);
    str_copy("", shift_str);

    display();
}

/*****************************************
 メインタスク
*****************************************/
void info_meter_output(void)
{
    display();
}

/*****************************************
 インフォメータ点灯
*****************************************/
void info_meter_on(void)
{
    display_state = en_On;
}

/*****************************************
 インフォメータ消灯
*****************************************/
void info_meter_off(void)
{
    display_state = en_Off;
}

/*****************************************
 READY表示設定
*****************************************/
void ready_display_set(const char *str)
{
    str_copy(str, ready_str);
}

/*****************************************
 動作モード表示設定
*****************************************/
void mode_display_set(const char *str)
{
    str_copy(str, mode_str);
}

/*****************************************
 シフトポジション表示設定
*****************************************/
void shift_display_set(const char *str)
{
    str_copy(str, shift_str);
}

/*****************************************
 インフォメータ表示
*****************************************/
static void display(void)
{
    if (display_state == en_On) {
        lcd_on();
        lcd_clear_all();

        // READY表示
        lcd_set_cursor(0, 0);
        lcd_put_string(ready_str);

        // 動作モード表示
        lcd_set_cursor(1, 0);
        lcd_put_string(mode_str);

        // シフトポジション表示
        lcd_set_cursor(1, 15);
        lcd_put_string(shift_str);

    } else {
        lcd_off();
    }
}

/*****************************************
 文字列コピー
*****************************************/
static void str_copy(const char *src, char *dst)
{
    while(*src != '\0') {
        *dst = *src;
        dst++;
        src++;
    }
    *dst = '\0';
}