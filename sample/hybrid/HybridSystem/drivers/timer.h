/********************************************************
 タイマドライバ
 *******************************************************/
#ifndef TIMER_H
#define TIMER_H

/*****************************************
 マクロ定数
*****************************************/

/*****************************************
 型
*****************************************/
/* 周期タイマ */
typedef unsigned long long TimerType;

/* 周期タイマ時間 */
typedef unsigned long long TimerTimeType;

/* 周期タイマ状態 */
typedef enum {
    TimerRunning,    /* タイマ計測中 */
    TimerFinished    /* タイマ満了 */
} TimerStateType;

/*****************************************
 関数
*****************************************/
extern void timer_init(void);                                      /* タイマ初期化 */
extern void timer_tick(void);                                      /* タイマカウント */
extern void timer_set(TimerTimeType after_time, TimerType *timer); /* 周期タイマ設定 */
extern TimerStateType timer_is_finished(TimerType timer);          /* 周期タイマ満了確認 */
extern void timer_wait_1ms(void);                                  /* 1ms割り込み発生待ち */

#endif /* TIMER_H */
