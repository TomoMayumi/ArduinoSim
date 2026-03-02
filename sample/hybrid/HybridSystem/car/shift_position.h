/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：shift_position.h                        *
 *  内容：     シフトポジション                         *
 *  日付：     2019/06/11                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __SHIFT_POSITION_H__
#define __SHIFT_POSITION_H__

/*
 * シフトポジション
 */

typedef enum {
    en_Parking = 0,    /* パーキング */
    en_Drive   = 1     /* ドライブ */
} ShiftPosType;

/* shiftpos_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      shiftpos_init();
 */
extern void shiftpos_init(void);

/* shiftpos_get()
 *
 * シフトポジション状態取得
 *
 * 使用例
 *      // シフトポジション状態取得
 *      ShiftPosType shift_position;
 *      shift_position = shiftpos_get();
 */
extern ShiftPosType shiftpos_get(void);

#endif    /* __SHIFT_POSITION_H__ */
