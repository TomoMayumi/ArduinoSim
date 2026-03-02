/********************************************************
 *  組み込み実装サンプルプログラム                      *
 *  ファイル名：speed_meter.h                           *
 *  内容：     スピードメータ                           *
 *  日付：     2019/06/14                               *
 *  note:                                               *
 *  作成者：yamashita_y                                 *
 *******************************************************/
#ifndef __SPEED_METER_H__
#define __SPEED_METER_H__

/*
 * スピードメータ
 */

/* speed_meter_init()
 *
 * 初期化処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // 初期化処理
 *      speed_meter_init();
 */
extern void speed_meter_init(void);

/* speed_meter_output()
 *
 * メインタスク処理 (メインループ周期で呼び出し)
 *
 * 使用例
 *      // メインタスク処理
 *      speed_meter_output();
 */
extern void speed_meter_output(void);

/* speed_meter_set()
 *
 * スピード設定
 *
 * 使用例
 *      // スピード設定 値域[0～9999]
 *      speed_meter_set(100);
 */
extern void speed_meter_set(unsigned char speed);

/* speed_meter_on()
 *
 * スピードメータ点灯
 *
 * 使用例
 *      // スピードメータ点灯
 *      speed_meter_on();
 */
extern void speed_meter_on(void);

/* speed_meter_off()
 *
 * スピードメータ消灯
 *
 * 使用例
 *      // スピードメータ消灯
 *      speed_meter_off();
 */
extern void speed_meter_off(void);

#endif // __SPEED_METER_H__
