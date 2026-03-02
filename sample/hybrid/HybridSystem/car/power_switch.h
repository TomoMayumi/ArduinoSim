/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：power_switch.h                          *
 *  内容：     パワースイッチ                           *
 *  日付：     2019/06/11                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __POWER_SWITCH_H__
#define __POWER_SWITCH_H__

/*
 * パワースイッチ
 */

typedef enum {
    en_SwOff = 0,    /* OFF */
    en_SwOn  = 1     /* ON */
} PswitchStateType;

typedef enum {
    en_SwChangeNone  = 0,    /* 変化イベントなし */
    en_SwChangeExist = 1     /* 変化イベントあり */
} PswitchEventType;

/* pswitch_init()
 *
 * 初期化処理
 *
 * 使用例
 *      // 初期化処理
 *      pswitch_init();
 */
extern void pswitch_init(void);

/* pswitch_input()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      pswitch_input();
 */
extern void pswitch_input(void);

/* pswitch_get()
 *
 * パワースイッチ状態取得
 *
 * 使用例
 *      // パワースイッチ状態取得
 *      PswitchStateType power_switch;
 *      power_switch = pswitch_get();
 */
extern PswitchStateType pswitch_get(void);

/* pswitch_check_event()
 *
 * パワースイッチ変化イベント有無の確認
 *
 * 使用例
 *      // イベントを確認し、クリア
 *      PswitchEventType event;
 *      event = pswitch_check_event();
 *      pswitch_clear_event();
 */
extern PswitchEventType pswitch_check_event(void);

/* pswitch_clear_event()
 *
 * パワースイッチ変化イベントの有無情報をクリア
 *
 * 使用例
 *      // イベントを確認し、クリア
 *      unsigned char event;
 *      pswitch_check_event(&event);
 *      pswitch_clear_event();
 */
extern void pswitch_clear_event(void);

#endif    /* __POWER_SWITCH_H__ */
