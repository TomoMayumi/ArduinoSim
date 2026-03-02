/********************************************************
 * 組込み実装サンプルプログラム                         *
 * ファイル名：hybridsystem.c                           *
 * 内容：ハイブリッドシステム                           *
 * 日付：2019/06/13                                     *
 * note:                                                *
 * 作成者：yamashita_y                                  *
 *******************************************************/
#include "drivers/timer.h"
#include "car/speed_meter.h"
#include "car/info_meter.h"
#include "car/shift_position.h"
#include "car/parking_break.h"
#include "car/power_switch.h"
#include "car/accelerator_pedal.h"
#include "car/ev_engine.h"
#include "drivers/input_adc.h"
#include "drivers/input_toggle.h"
#include "drivers/output_led7seg.h"
#include "drivers/output_lcd.h"
#include "drivers/output_pwm.h"

/*****************************************
 define
*****************************************/
#define START_ENG_SPEED 20           /*  [km/h] */
#define STOP_ENG_SPEED 0             /*  [km/h] */
#define AUTO_OFF_TIME_ACC 5000       /*  [ms] */
#define AUTO_OFF_TIME_IG_ON 10000    /*  [ms] */

typedef enum {
    en_Off,    /*  停止中、OFF */
    en_Acc,    /*  停止中、ACC */
    en_IgOn,   /*  停止中、IG ON */
    en_Ev,     /*  動作中、EV走行 */
    en_Eng     /*  動作中、ENG走行 */
} SystemStateType;

/*****************************************
 変数宣言
*****************************************/
static SystemStateType state;
static TimerType auto_off_timer;

/*****************************************
 関数プロトタイプ宣言
*****************************************/
/*  PF */
void initialize(void);
void main_task(void);

/*  HybridSystem */
void        hybridsystem_init(void);
void        hybridsystem_task(void);
static void control_device(void);
static void control_state(void);
static unsigned char calc_output(void);

/*****************************************
 main関数
*****************************************/
int main(void)
{
    initialize();    /*  初期化 */

    while (1) {
        main_task();
        timer_wait_1ms();    /*  1ms タイマウェイト */
    }
	return 0;
}

/*****************************************
 初期化
*****************************************/
void initialize(void)
{
    /*  ドライバ */
    timer_init();
    adc_init();
    pwm_init();
    led7seg_init();
    lcd_init();
    toggle_init();
    adc_start();

    /*  中間 */
    speed_meter_init();
    info_meter_init();
    shiftpos_init();
    pbreak_init();
    pswitch_init();
    accelpedal_init();
    engine_init();

    /*  アプリ */
    hybridsystem_init();
}

/*****************************************
 メインタスク
*****************************************/
void main_task(void)
{
    /*  入力ドライバ */
    adc_convert();
    toggle_scan();
    timer_tick();

    /*  入力調停 */
    pswitch_input();
    accelpedal_input();

    /*  アプリ */
    hybridsystem_task();

    /*  出力調停 */
    info_meter_output();
    speed_meter_output();
    engine_output();

    /*  出力ドライバ */
    led7seg_display();
    lcd_display();
    pwm_output();
}

/*****************************************
 ハイブリッドシステム初期化
*****************************************/
void hybridsystem_init(void)
{
    state          = en_Off;
    auto_off_timer = 0;

    /*  Enter OFF */
    /*  エンジン出力 */
    engine_set(0);

    /* スピードメーター */
    speed_meter_off();

    /* インフォ表示 */
    info_meter_off();
}

/*****************************************
 ハイブリッドシステムメインタスク
*****************************************/
void hybridsystem_task(void)
{
    control_device();
    control_state();
}

/*****************************************
 デバイス制御
*****************************************/
static void control_device(void)
{
    unsigned char output;
    ShiftPosType shift_position;

    // 共通処理
    // インフォ表示
    shift_position = shiftpos_get();
    if (shift_position == en_Parking) {
        shift_display_set("P");
    } else {
        shift_display_set("D");
    }

    // 状態固有処理
    switch (state) {
    case en_Off:
        /*  エンジン出力 */
        engine_set(0);

        /* スピードメーター */
        speed_meter_off();

        /* インフォ表示 */
        info_meter_off();

        break;

    case en_Acc:
        /*  エンジン出力 */
        engine_set(0);

        /* スピードメーター */
        speed_meter_off();

        /* インフォ表示 */
        info_meter_on();
        ready_display_set("");
        mode_display_set("ACC");

        /*  自動OFF機能 */
        if (shift_position != en_Parking) {    /*  シフトポジションがP以外だったら、タイマリセット */
            timer_set(AUTO_OFF_TIME_ACC, &auto_off_timer);
        }

        break;

    case en_IgOn:
        /*  エンジン出力 */
        engine_set(0);

        /* スピードメーター */
        speed_meter_on();

        /* インフォ表示 */
        info_meter_on();
        ready_display_set("");
        mode_display_set("IG ON");

        /*  自動OFF機能 */
        if (shift_position != en_Parking) {    /*  シフトポジションがP以外だったら、タイマリセット */
            timer_set(AUTO_OFF_TIME_IG_ON, &auto_off_timer);
        }

        break;

    case en_Ev:
        /*  エンジン出力 */
        output = calc_output();
        engine_set(output);

        /* スピードメーター */
        speed_meter_on();
        speed_meter_set(output);

        /* インフォ表示 */
        info_meter_on();
        ready_display_set("READY");
        mode_display_set("EV");

        break;

    case en_Eng:
        /*  エンジン出力 */
        output = calc_output();
        engine_set(output);

        /* スピードメーター */
        speed_meter_on();
        speed_meter_set(output);

        /* インフォ表示 */
        info_meter_on();
        ready_display_set("READY");
        mode_display_set("ENG");

        break;

    default:
        break;
    };
}

/*****************************************
 状態制御
*****************************************/
static void control_state(void)
{
    PswitchEventType event;
    PswitchStateType power_switch;
    ShiftPosType shift_position;
    PbreakStateType parking_break;
    unsigned char speed;
    TimerStateType is_finished_timer;

    shift_position = shiftpos_get();
    parking_break = pbreak_get();
    speed = calc_output();    /*  エンジン&モーター出力とスピードはイコールの関係 */
    power_switch = pswitch_get();
    event = pswitch_check_event();
    pswitch_clear_event();
    is_finished_timer = timer_is_finished(auto_off_timer);

    switch (state) {
    case en_Off:
        if (event == en_SwChangeExist) {
            if ((power_switch == en_SwOn) && (shift_position == en_Parking) && (parking_break == en_BreakOn)) {
                /*  Exit OFF */
                /*  Enter EV走行 */
                state = en_Ev;
            } else if (power_switch == en_SwOn) {
                /*  Exit OFF */
                /*  Enter ACC */
                timer_set(AUTO_OFF_TIME_ACC, &auto_off_timer);
                state = en_Acc;
            } else {
                /*  状態変化なし */
            }
        }
        break;

    case en_Acc:
        if (event == en_SwChangeExist) {
            if ((power_switch == en_SwOn) && (shift_position == en_Parking) && (parking_break == en_BreakOn)) {
                /*  Exit ACC */
                /*  Enter EV走行 */
                state = en_Ev;
            } else if (power_switch == en_SwOn) {
                /*  Exit ACC */
                /*  Enter IG ON */
                timer_set(AUTO_OFF_TIME_IG_ON, &auto_off_timer);
                state = en_IgOn;
            } else {
                /*  状態変化なし */
            }
        } else if (is_finished_timer == TimerFinished) {
            /*  Exit ACC */
            /*  Enter OFF */
            state = en_Off;
        } else {
            /*  状態変化なし */
        }
        break;

    case en_IgOn:
        if (event == en_SwChangeExist) {
            if ((power_switch == en_SwOn) && (shift_position == en_Parking) && (parking_break == en_BreakOn)) {
                /*  Exit IG ON */
                /*  Enter EV走行 */
                state = en_Ev;
            } else if (power_switch == en_SwOn) {
                /*  Exit IG ON */
                /*  Enter OFF */
                state = en_Off;
            } else {
                /*  状態変化なし */
            }
        } else if (is_finished_timer == TimerFinished) {
            /*  Exit IG ON */
            /*  Enter OFF */
            state = en_Off;
        } else {
            /*  状態変化なし */
        }
        break;

    case en_Ev:
        if (event == en_SwChangeExist) {
            if ((power_switch == en_SwOn) && (shift_position == en_Parking) && (parking_break == en_BreakOn)) {
                /*  Exit EV走行 */
                /*  Enter OFF */
                state = en_Off;
            } else {
                /*  状態変化なし */
            }
        } else if (speed >= START_ENG_SPEED) {
            /*  Exit EV走行 */
            /*  Enter ENG走行 */
            state = en_Eng;
        } else {
            /*  状態変化なし */
        }
        break;

    case en_Eng:
        if (event == en_SwChangeExist) {
            if ((power_switch == en_SwOn) && (shift_position == en_Parking) && (parking_break == en_BreakOn)) {
                /*  Exit EV走行 */
                /*  Enter OFF */
                state = en_Off;
            } else {
                /*  状態変化なし */
            }
        } else if (speed <= STOP_ENG_SPEED) {
            /*  Exit ENG走行 */
            /*  Enter EV走行 */
            state = en_Ev;
        } else {
            /*  状態変化なし */
        }
        break;

    default:
        break;
    };
}

/*****************************************
 エンジン&モーター出力計算
*****************************************/
static unsigned char calc_output(void)
{
    ShiftPosType shift_position;
    PbreakStateType parking_break;
    unsigned char accelerator_pedal;
	unsigned char output;

    shift_position = shiftpos_get();
    parking_break = pbreak_get();
    accelerator_pedal = accelpedal_get();

    if ((parking_break == en_BreakOn) || (shift_position == en_Parking)) {
        output = 0;
    } else {
        output = accelerator_pedal;
    }
	return output;
}
