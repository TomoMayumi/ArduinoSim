/********************************************************
 PWMデバイスドライバ
 *******************************************************/
#ifndef OUTPUT_PWM_H
#define OUTPUT_PWM_H

/*****************************************
 マクロ定数
*****************************************/

/*****************************************
 型
*****************************************/

/*****************************************
 関数
*****************************************/
extern void pwm_init(void);                                                /* PWM初期化 */
extern void pwm_output(void);                                              /* PWM出力設定 */
extern void pwm_motor_on(void);                                            /* モーター出力オン */
extern void pwm_motor_off(void);                                           /* モーター出力オフ */
extern void pwm_motor_stop_urgently(void);                                 /* モーター即時停止 */
extern void pwm_set_duty(unsigned long period_in_us, unsigned char duty);  /* PWM周期・デューティ比設定 */

#endif /* OUTPUT_PWM_H */
