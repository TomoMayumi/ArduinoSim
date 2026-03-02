/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：info_meter.h                            *
 *  内容：     インフォメータ                           *
 *  日付：     2019/06/14                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __INFO_METER_H__
#define __INFO_METER_H__

/*
 * インフォメータ
 */

/* info_meter_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      info_meter_init();
 */
extern void info_meter_init(void);

/* info_meter_output()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      info_meter_output();
 */
extern void info_meter_output(void);

/* info_meter_on()
 *
 * インフォメータ点灯
 *
 * 使用例
 *      // インフォメータ点灯
 *      info_meter_on();
 */
extern void info_meter_on(void);

/* info_meter_off()
 *
 * インフォメータ消灯
 *
 * 使用例
 *      // インフォメータ消灯
 *      info_meter_off();
 */
extern void info_meter_off(void);

/* ready_display_set()
 *
 * READY表示設定
 *
 * 使用例
 *      // READY表示設定(5文字まで)
 *      ready_display_set("");
 *      ready_display_set("READY");
 */
extern void ready_display_set(const char *str);

/* mode_display_set()
 *
 * 動作モード表示設定
 *
 * 使用例
 *      // 動作モード表示設定(5文字まで)
 *      mode_display_set("ACC");
 *      mode_display_set("IG ON");
 */
extern void mode_display_set(const char *str);

/* shift_display_set()
 *
 * シフトポジション表示設定
 *
 * 使用例
 *      // シフトポジション表示設定(1文字まで)
 *      shift_display_set("P");
 *      shift_display_set("D");
 */
extern void shift_display_set(const char *str);

#endif // __INFO_METER_H__
