/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：indicatior.h                            *
 *  内容：     インジケータ                             *
 *  日付：     2019/06/13                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __INDICATOR_H__
#define __INDICATOR_H__

/*
 * インジケータ
 */

/* indicator_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      indicator_init();
 */
extern void indicator_init(void);

/* indicator_output()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      indicator_output();
 */
extern void indicator_output(void);

/* engine_display_on()
 *
 * ENG表示点灯
 *
 * 使用例
 *      // ENG表示点灯
 *      engine_display_on();
 */
extern void engine_display_on(void);

/* engine_display_off()
 *
 * ENG表示消灯
 *
 * 使用例
 *      // ENG表示消灯
 *      engine_display_off();
 */
extern void engine_display_off(void);

/* ready_display_on()
 *
 * READY表示点灯
 *
 * 使用例
 *      // READY表示点灯
 *      ready_display_on();
 */
extern void ready_display_on(void);

/* ready_display_off()
 *
 * READY表示消灯
 *
 * 使用例
 *      // READY表示消灯
 *      ready_display_off();
 */
extern void ready_display_off(void);

/* ig_on_display_on()
 *
 * IG ON表示点灯
 *
 * 使用例
 *      // IG ON表示点灯
 *      ig_on_display_on();
 */
extern void ig_on_display_on(void);

/* ig_on_display_off()
 *
 * IG ON表示消灯
 *
 * 使用例
 *      // IG ON表示消灯
 *      ig_on_display_off();
 */
extern void ig_on_display_off(void);

/* acc_display_on()
 *
 * ACC表示点灯
 *
 * 使用例
 *      // ACC表示点灯
 *      acc_display_on();
 */
extern void acc_display_on(void);

/* acc_display_off()
 *
 * ACC表示消灯
 *
 * 使用例
 *      // ACC表示消灯
 *      acc_display_off();
 */
extern void acc_display_off(void);

#endif /* __INDICATOR_H__ */
