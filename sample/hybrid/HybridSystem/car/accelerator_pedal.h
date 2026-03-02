/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：accelerator_pedal.h                     *
 *  内容：     アクセルペダル                           *
 *  日付：     2019/06/11                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __ACCELERATOR_PEDAL_H__
#define __ACCELERATOR_PEDAL_H__

/*
 * アクセルペダル
 */

/* accelpedal_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      accelpedal_init();
 */
extern void accelpedal_init(void);

/* accelpedal_input()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      accelpedal_input();
 */
extern void accelpedal_input(void);

/* accelpedal_get()
 *
 * アクセルペダル位置取得
 *
 * 使用例
 *      // アクセルペダルの位置を取得する
 *      unsigned char position;
 *      position = accelpedal_get();
 */
extern unsigned char accelpedal_get(void);

#endif    /* __ACCELERATOR_PEDAL_H__ */
