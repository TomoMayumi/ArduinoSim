/********************************************************
 トグル入力 デバイスドライバ
 *******************************************************/
#ifndef INPUT_TOGGLE_H
#define INPUT_TOGGLE_H

/*****************************************
 マクロ定数
*****************************************/
/* トグルキー のオンオフ状態 */
typedef unsigned char ToggleBitType;
#define TOGGLE_BIT_NONE (0b00000000) /* なし */
#define TOGGLE_BIT_POS0 (0b00000001) /* トグルポジション0(トグル1) */
#define TOGGLE_BIT_POS1 (0b00000010) /* トグルポジション1(トグル2) */
#define TOGGLE_BIT_POS2 (0b00000100) /* トグルポジション2(トグル3) */
#define TOGGLE_BIT_POS3 (0b00001000)
#define TOGGLE_BIT_POS4 (0b00010000)
#define TOGGLE_BIT_POS5 (0b00100000)
#define TOGGLE_BIT_POS6 (0b01000000)
#define TOGGLE_BIT_POS7 (0b10000000)

/*****************************************
 型
*****************************************/

/*****************************************
 関数
*****************************************/
extern void toggle_init(void);                  /* トグル初期化 */
extern void toggle_scan(void);                  /* トグル状態確認 */
extern ToggleBitType toggle_check_event(void);  /* トグル変化イベント確認 */
extern void toggle_clear_event(void);           /* トグル変化イベントクリア */
extern ToggleBitType toggle_get_state(void);    /* トグル状態取得 */

#endif /* INPUT_TOGGLE_H */
