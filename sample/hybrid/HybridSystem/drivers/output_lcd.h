/********************************************************
 LCD デバイスドライバ
 *******************************************************/
#ifndef OUTPUT_LCD_H
#define OUTPUT_LCD_H

/*****************************************
 マクロ定数
*****************************************/
/* LCDドライバ用ブール値 */
#define LCD_TRUE            (1)
#define LCD_FALSE           (0)

/*****************************************
 型
*****************************************/
/* LCD初期化状態 */
typedef enum {
    LcdInitWait,    /* 初期化中 */
    LcdInitComplete /* 初期化完了 */
} LcdInitStateType;

/*****************************************
 関数
*****************************************/
extern void lcd_init(void);                                                         /* LCD初期化開始 */
extern LcdInitStateType lcd_init_seq(void);                                         /* LCD初期化シーケンス実施 */
extern void lcd_display(void);                                                      /* LCD表示更新 */
extern void lcd_display_sample(void);                                               /* サンプル文字列の表示 */
extern void lcd_on(void);                                                           /* LCD表示オン */
extern void lcd_off(void);                                                          /* LCD表示オフ */
extern void lcd_put_string(const char* str);                                        /* 文字列表示 */
extern void lcd_put_num_char(unsigned char value, unsigned char zero_padding);      /* 数値表示(3桁) */
extern void lcd_put_num_short(unsigned short value, unsigned char zero_padding);    /* 数値表示(5桁) */
extern void lcd_set_dot_pattern(unsigned char address, unsigned char* image);       /* CGRAM設定 */
extern void lcd_put_char(char out);                                                 /* 文字出力 */
extern void lcd_set_cursor_home(void);                                              /* カーソル初期化 */
extern void lcd_clear_all(void);                                                    /* 全表示クリア */
extern void lcd_clear_line(unsigned char row);                                      /* 行表示クリア */
extern void lcd_set_cursor(unsigned char row, unsigned char col);                   /* カーソル移動 */

#endif /* OUTPUT_LCD_H */
