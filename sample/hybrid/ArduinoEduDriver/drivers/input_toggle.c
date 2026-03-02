/********************************************************
 トグル入力 デバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "input_toggle.h"

/*****************************************
　define
*****************************************/
#define TOGGLE_PORT_DATA_REG            PINC
#define TOGGLE_PORT_PULLUP_REG          PORTC
#define TOGGLE_PORT_DDR_REG             DDRC

#define TOGGLE_BIT                      (0b00001111)    /* 1：トグル使用ポート */

#define TOGGLE_CHATTERING_COUNT         (0)             /*  チャタリング除去判定回数(0：チャタリング除去しない) */

#define TOGGLE_TRUE                     (1)
#define TOGGLE_FALSE                    (0)

/*****************************************
 関数プロトタイプ宣言
*****************************************/
/*  Key input driver (low level) */
static ToggleBitType toggle_input_from_port(void);

/*****************************************
 変数定義
*****************************************/
static ToggleBitType toggle_event = TOGGLE_BIT_NONE;  /* 外部公開用トグルイベント  0 : キー変化なし / 1 : キー変化あり */
static ToggleBitType toggle_state = TOGGLE_BIT_NONE;  /* 外部公開用トグルコード    0 : オフ / 1 : オン */

static ToggleBitType toggle_state_pending;            /* トグルキー チャタリング除去中情報 */
static unsigned char toggle_pending_count;            /* トグルキー チャタリング除去カウント */
static unsigned char toggle_first_boot;               /* 起動後初回である */

/*****************************************
 トグル初期化
*****************************************/
void toggle_init(void)
{
    TOGGLE_PORT_DDR_REG &= (~TOGGLE_BIT); /* トグル用ポートを入力(0)に設定 */
    TOGGLE_PORT_PULLUP_REG |= TOGGLE_BIT; /* トグル用ポートをプルアップあり(1)に設定 */

    toggle_event = TOGGLE_BIT_NONE;
    toggle_state = TOGGLE_BIT_NONE;
    toggle_state_pending = TOGGLE_BIT_NONE;
    toggle_pending_count = 0;
    toggle_first_boot = TOGGLE_TRUE;
}

/*****************************************
 トグル状態チェック処理
*****************************************/
void toggle_scan(void)
{
    unsigned char count;
    ToggleBitType state_latest;

    /* 入力ポート情報を読み込んでトグルキービットを抜き出す */
    state_latest = toggle_input_from_port();

    if (toggle_first_boot != TOGGLE_FALSE) {
        /* ブート後初回は全トグルを変化ありとする */
        toggle_first_boot = TOGGLE_FALSE;
        toggle_event = TOGGLE_BIT;
        toggle_state = state_latest;
        toggle_state_pending = state_latest;
    } else {
        /* チャタリング除去処理 */
        /* キー変化なしのまま規定時間経過したらキーの状態を確定する */
        if (toggle_state_pending != state_latest) {     /* キー変化あり */
            /* チャタリング除去処理開始 */
            toggle_state_pending = state_latest;
            count = TOGGLE_CHATTERING_COUNT;
            toggle_pending_count = TOGGLE_CHATTERING_COUNT;
        } else{                                                                     /* キー変化なし */
            count = toggle_pending_count;
            if (count > 0) { /* チャタリング除去中 */
                /* チャタリング除去カウンタを更新 */
                count--;
                toggle_pending_count = count;
            }
        }
        if (count == 0) { /* チャタリング除去カウント終了 */
            /*  確定値保存 */
            toggle_event |= toggle_state ^ toggle_state_pending;

            toggle_state = toggle_state_pending;
        }
    }
}

/*****************************************
 トグル変化情報取得
*****************************************/
ToggleBitType toggle_check_event(void)
{
    return toggle_event;
}

/*****************************************
 トグル変化イベント有無情報クリア
*****************************************/
void toggle_clear_event(void)
{
    toggle_event = TOGGLE_BIT_NONE;
}

/*****************************************
 トグル状態取得
*****************************************/
ToggleBitType toggle_get_state(void)
{
    return toggle_state;
}

/*****************************************
 トグルキー情報をポートから取得
*****************************************/
static ToggleBitType toggle_input_from_port(void)
{
    return (TOGGLE_PORT_DATA_REG & TOGGLE_BIT);
}
