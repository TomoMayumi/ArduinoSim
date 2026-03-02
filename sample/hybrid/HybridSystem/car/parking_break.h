/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：parking_break.h                         *
 *  内容：     パーキングブレーキ                       *
 *  日付：     2019/06/11                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __PARKING_BREAK_H__
#define __PARKING_BREAK_H__

/*
 * パーキングブレーキ
 */

typedef enum {
    en_BreakOff = 0,    /* OFF */
    en_BreakOn  = 1     /* ON */
} PbreakStateType;

/* pbreak_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      pbreak_init();
 */
extern void pbreak_init(void);

/* pbreak_get()
 *
 * パーキングブレーキ状態取得
 *
 * 使用例
 *      // パーキングブレーキ状態取得
 *      PbreakStateType parking_break;
 *      pbreak_get(&parking_break);
 */
extern PbreakStateType pbreak_get(void);

#endif    /* __PARKING_BREAK_H__ */
