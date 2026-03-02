/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：power_switch.c                          *
 *  内容：     パワースイッチ                           *
 *  日付：     2019/06/13                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#include "power_switch.h"

#include "drivers/input_toggle.h"

/*****************************************
 define
*****************************************/
#define PSWITCH_BIT (TOGGLE_BIT_POS2)

/*****************************************
 関数プロトタイプ宣言
*****************************************/
static PswitchStateType get_sw_status(void);

/*****************************************
 変数宣言
*****************************************/
static PswitchStateType sw_status;
static PswitchEventType sw_event;

/*****************************************
 初期化
*****************************************/
void pswitch_init(void)
{
    sw_status = get_sw_status();
    sw_event = en_SwChangeNone;
}

/*****************************************
 メインタスク
*****************************************/
void pswitch_input(void)
{
    PswitchStateType now_status;

    now_status = get_sw_status();
    if (now_status != sw_status) {
        sw_event = en_SwChangeExist;
    }
    sw_status = now_status;
}

/*****************************************
 パワースイッチ状態取得
*****************************************/
PswitchStateType pswitch_get(void)
{
    return sw_status;
}

/*****************************************
 パワースイッチ変化イベント有無の確認
*****************************************/
PswitchEventType pswitch_check_event(void)
{
    return sw_event;
}

/*****************************************
 パワースイッチ変化イベントの有無情報をクリア
*****************************************/
void pswitch_clear_event(void)
{
    sw_event = en_SwChangeNone;
}

/*****************************************
 現在のパワースイッチ状態取得
*****************************************/
static PswitchStateType get_sw_status(void)
{
	PswitchStateType status;
	unsigned char onoff;

    onoff = toggle_get_state();
    if ((onoff & PSWITCH_BIT) != 0) {
        status = en_SwOn;    /* トグルスイッチの位置が右 */
    } else {
        status = en_SwOff;    /* トグルスイッチの位置が左 */
    }
	return status;
}