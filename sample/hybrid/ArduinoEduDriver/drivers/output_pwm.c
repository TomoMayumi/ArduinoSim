/********************************************************
 PWMデバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "output_pwm.h"

/*****************************************
 define
*****************************************/
#define PWM_PORT_DIR_REG    DDRB
#define PWM_PORT_BIT        (0b00000100)


/* COM1A1,0 : 比較A出力選択 00(標準ポート動作) */
/* COM1B1,0 : 比較B出力選択 11(高速PWMの反転動作) (デューティー比0の場合にパルスのひげが出ないようにするため反転動作とする)*/
/* WGM11,0 : 波形生成種別下位2ビット 11(高速PWM動作(TOP:OCR1A)) */
#define PWM_TCCR1A_INIT     ( _BV(COM1B1) | _BV(COM1B0) | _BV(WGM11) | _BV(WGM10) )

/* ICNC1 : 捕獲起動入力1雑音消去許可 0 (禁止) */
/* ICES1 : 捕獲起動入力端選択 0 (変更しない) */
/* WGM13,12 : 波形生成種別上位2ビット 11 (高速PWM動作(TOP:OCR1A)) */
/* CS12,11,10 : 000 タイマが開始してしまうため、タイマ開始時に設定 */
#define PWM_TCCR1B_OFF      ( _BV(WGM13) | _BV(WGM12) )

/* CS12,11,10 : 011 64分周(16MHzの64分周で1カウント4us) */
#define PWM_TCCR1B_ON       ( PWM_TCCR1B_OFF | _BV(CS11) | _BV(CS10) )

/* FOC1A : OC0A強制変更 0 (なし) */
/* FOC1B : OC0B強制変更 0 (なし) */
#define PWM_TCCR1C_INIT     (0x00)

/* PWM制御のデューティ比設定レジスタ値：レジスタへの設定の都合で右式のxの値を指定 (1 - x/OCR1A) */
#define PWM_OCR1B_INIT      (PWM_OCR1A_INIT)    /* PWMオフ(デューティ比：0% = 周期と同じ */

/* PWM制御の周期設定レジスタ値： */
#define PWM_OCR1A_INIT      (50000)     /* 周期200000us(1周期4us * 50000) */

#define PWM_DUTY_LIMIT      (100)       /* 最大デューティ 100 % */
#define PWM_PERIOD_LIMIT    (200000)    /* 最大周期 200000us(=200ms) */

typedef enum {
    PwmOff,        /* PWMオフ */
    PwmOn          /* PWMオン */
} PwmStateType;

/*****************************************
 関数プロトタイプ宣言
*****************************************/

/*  PWM driver (low level ：ポートアクセス) */
static void set_pwm_counter_reg(void);
static void sta_count_pwm(void);
static void stp_count_pwm(void);

/*****************************************
 変数宣言
*****************************************/
static PwmStateType pwm_state;          /* PWMオン・オフ状態 */
static PwmStateType pwm_state_set;      /* PWMオン・オフ状態(未反映分) */
static unsigned short pwm_duty;         /* デューティ比指定レジスタ値 */
static unsigned short pwm_period;       /* 周期指定レジスタ値 */
static unsigned char changed_duty;      /* デューティ変更要求フラグ */

/*****************************************
 PWM初期設定(タイマ2)
*****************************************/
void pwm_init(void)
{
    /* RAM初期化	*/
    pwm_state = PwmOff;
    pwm_state_set = PwmOff;
    pwm_duty = PWM_OCR1B_INIT;
    pwm_period = PWM_OCR1A_INIT;
    changed_duty = 0;

    /* レジスタ初期化 PWM用タイマ設定 */
    TCCR1A = PWM_TCCR1A_INIT;
    TCCR1B = PWM_TCCR1B_OFF;
    TCNT1 = 0;                  /* カウンタクリア */
    OCR1B = PWM_OCR1B_INIT;     /* 初期値はデューティ比0 */
    OCR1A = PWM_OCR1A_INIT;     /* 初期値は周期200ms(=200000us) とし、レジスタ値は 200000us/4us = 50000 */

    /* ポート設定 */
    PWM_PORT_DIR_REG |= PWM_PORT_BIT;

    /* PWM用タイマ開始 */
    TCCR1B = PWM_TCCR1B_ON;
}

/*****************************************
 PWM出力制御(1ms周期呼び出し)
*****************************************/
void pwm_output(void)
{
    if (changed_duty == 1) { /* 変更要求あり */
        changed_duty = 0; /* デューティ変更フラグをクリア */
        set_pwm_counter_reg();
    }

    if (pwm_state != pwm_state_set) { /* モータ駆動状態変化あり */
        pwm_state = pwm_state_set;

        if (pwm_state == PwmOff) {
            stp_count_pwm();
        } else { /* pwm_state == PwmOn */
            sta_count_pwm();
        }
    }
}

/*****************************************
 モーター オン設定
*****************************************/
void pwm_motor_on(void)
{
    pwm_state_set = PwmOn;
}

/*****************************************
 モーター オフ設定
*****************************************/
void pwm_motor_off(void)
{
    pwm_state_set = PwmOff;
}

/*****************************************
 モーター緊急オフ
*****************************************/
void pwm_motor_stop_urgently(void)
{
    stp_count_pwm();
}

/*****************************************
 PWM 周期，デューティ設定
*****************************************/
void pwm_set_duty(unsigned long period_in_us, unsigned char duty)
{
    unsigned long new_period;
    unsigned long new_duty;

    new_period = period_in_us;
    if (new_period > PWM_PERIOD_LIMIT) {
        new_period = PWM_PERIOD_LIMIT;
    }
    new_duty = duty;
    if (new_duty > PWM_DUTY_LIMIT) {
        new_duty = PWM_DUTY_LIMIT;
    }

    pwm_period = new_period/4; /* PWMタイマ1周期4usでカウントするので4で割る */
    pwm_duty = pwm_period - (new_duty*pwm_period/100); /* 周期に対するデューティー比設定値を計算 */
    changed_duty = 1;
}

/*****************************************
 PWM カウンタ設定変更
*****************************************/
static void set_pwm_counter_reg(void)
{
    if (pwm_state == PwmOff) {
        OCR1A = pwm_period;
        OCR1B = pwm_period;
    } else {
        OCR1A = pwm_period;
        OCR1B = pwm_duty;
    }
}

/*****************************************
 PWMカウンタ動作開始
*****************************************/
static void sta_count_pwm(void)
{
    OCR1B = pwm_duty; /* PWMデューティ比 設定値 */
}

/*****************************************
 PWMカウンタ動作終了
*****************************************/
static void stp_count_pwm(void)
{
    OCR1B = pwm_period; /* PWMデューティ比 0% = 周期と同じ */
}
