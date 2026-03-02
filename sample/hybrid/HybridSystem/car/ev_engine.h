/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：ev_engine.h                             *
 *  内容：     エンジン&モーター                        *
 *  日付：     2019/06/11                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __EV_ENGINE_H__
#define __EV_ENGINE_H__

/*
 * エンジン&モーター
 */

/* engine_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      engine_init();
 */
extern void engine_init(void);

/* engine_output()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      engine_output();
 */
extern void engine_output(void);

/* engine_set()
 *
 * エンジン&モーター出力設定
 *
 * 使用例
 *      // 出力設定 値域[0～100]
 *      engine_set(0);   // 停止
 *      engine_set(100); // 最大出力
 */
extern void engine_set(unsigned char ratio);

#endif    /* __EV_ENGINE_H__ */
