/********************************************************
 LCD デバイスドライバ
 *******************************************************/
#include <avr/io.h>
#include "output_lcd.h"

/*****************************************
 マクロ定数
*****************************************/
/* ポート設定 */
#define LCD_PORT_DATA_REG   PORTD
#define LCD_PORT_DDR_REG    DDRD
#define LCD_PORT_RS_BIT     (0b00010000)
#define LCD_PORT_E_BIT      (0b00100000)
#define LCD_PORT_DATA_BIT   (0b00001111)
#define LCD_PORT_ALL_BIT    (LCD_PORT_RS_BIT | LCD_PORT_E_BIT | LCD_PORT_DATA_BIT)

/* LCDバッファサイズ設定 */
#define LCD_ROW_SIZE        (2)
#define LCD_COL_SIZE        (16)
#define LCD_BUF_SIZE        (LCD_ROW_SIZE * LCD_COL_SIZE)

/* 待ち時間設定 */
#define LCD_BOOT_WAIT       (50) /* 電源ON時初回コマンド送信待ち時間[ms] */
#define LCD_INIT_CMD_WAIT   (4)  /* 初期化コマンド反映待ち時間[ms] */

/* 初期化シーケンス番号 */
#define LCD_INIT_SEQ_0          (0)
#define LCD_INIT_SEQ_1          (1)
#define LCD_INIT_SEQ_2          (2)
#define LCD_INIT_SEQ_3          (3)
#define LCD_INIT_SEQ_4          (4)
#define LCD_INIT_SEQ_5          (5)
#define LCD_INIT_SEQ_6          (6)
#define LCD_INIT_SEQ_7          (7)

#define LCD_INIT_SEQ_COMPLETE   (LCD_INIT_SEQ_7)

/*****************************************
 型
*****************************************/
/* LCD表示状態 */
typedef enum {
    LcdStateOff,     /*  LCDオフ */
    LcdStateOn       /*  LCDオン */
} LcdStateType;


/*****************************************
 関数
*****************************************/
static void lcd_put_num(unsigned short value, unsigned char digit, unsigned char zero_padding);
static void lcd_disp_on(void);
static void lcd_disp_off(void);
static unsigned char lcd_check_buffer_diff(void);
static void lcd_output_string(const unsigned char* str, unsigned char row);      /*  output String Data */
static void lcd_output_char(unsigned char data, unsigned char row, unsigned char col);   /*  output Char Data */
static void lcd_out_init_command(unsigned char);       /* LCD initial setting command output */
static void lcd_out_command8bit(unsigned char);        /* LCD 1 command output */
static void lcd_out_data8bit(unsigned char);           /* LCD 1 date output */
static void lcd_out_lcd4bit(unsigned char outdata);    /* LCD データポート出力 */
static void lcd_out_rs_to_data(void);
static void lcd_out_rs_to_cmd(void);
static void lcd_wait_us(unsigned short us);

/*****************************************
 変数
*****************************************/
static LcdStateType lcd_state;              /* LCD表示状態 */
static LcdStateType lcd_state_pending;      /* LCD表示状態(反映前) */
static unsigned char lcd_init_seq_cnt;      /* 現在の初期化シーケンス番号 */
static unsigned char lcd_init_cmd_wait_cnt; /* 初期化用待ち時間カウンタ */
static unsigned char lcd_input_cursor;      /* カーソル位置(バッファ書き込み用) */
static unsigned char lcd_output_cursor;     /* カーソル位置(LCD出力用) */
static unsigned char lcd_disp_updating;     /* 表示更新処理中フラグ */

/* 表示データの一時保存用バッファ */
static char lcd_buf_pending[LCD_ROW_SIZE][LCD_COL_SIZE];
/* 表示用データバッファ */
static char lcd_buf[LCD_ROW_SIZE][LCD_COL_SIZE];

/* サンプル表示用文字列定数 */
static const unsigned char lcd_sample_data[LCD_ROW_SIZE][LCD_COL_SIZE] = {
    {' ','W','e','l','c','o','m','e','!','!',' ',' ',' ',' ',' ',' '},
    {' ','a','r','d','u','i','n','o',' ','s','a','m','p','l','e',' '}
};

/* 行ごとのLCD表示先頭アドレス */
static const unsigned char lcd_row_offset_address[LCD_ROW_SIZE] = {
    0x80,
    0xc0
};

/*****************************************
 LCD初期設定
*****************************************/
void lcd_init( void )
{
    unsigned char row;
    unsigned char col;

    /* ポート(LCD)初期設定 */
    LCD_PORT_DDR_REG |= LCD_PORT_ALL_BIT;
    LCD_PORT_DATA_REG &= (~LCD_PORT_ALL_BIT);

    lcd_state = LcdStateOff;
    lcd_state_pending = LcdStateOn; /* 初期化完了時の状態を想定してONを入れておき、初期化途中でもOFF要求を受け付けられるようにする */
    lcd_input_cursor = 0;
    lcd_output_cursor = 0;
    lcd_disp_updating = LCD_FALSE;

    for (row = 0; row < LCD_ROW_SIZE; row++) {
        for (col = 0; col < LCD_COL_SIZE; col++) {
            lcd_buf[row][col] = ' ';
            lcd_buf_pending[row][col] = ' ';
        }
    }

    lcd_init_seq_cnt = LCD_INIT_SEQ_0;
    lcd_init_cmd_wait_cnt = LCD_BOOT_WAIT;
}

/*****************************************
 初期化シーケンス実施
*****************************************/
LcdInitStateType lcd_init_seq(void)
{
    LcdInitStateType init_state;
    unsigned char init_seq_cnt;

    init_state = LcdInitWait;

    init_seq_cnt = lcd_init_seq_cnt;
    switch (init_seq_cnt) {
        case LCD_INIT_SEQ_0:
            /* 電源ON～コマンド送信前ウエイト */
            lcd_init_cmd_wait_cnt--;
            if(lcd_init_cmd_wait_cnt == 0){
                init_seq_cnt = LCD_INIT_SEQ_1;
            }
            break;

        case LCD_INIT_SEQ_1:
            lcd_out_init_command(0x03);         /* LCDファンクションセット */
            init_seq_cnt = LCD_INIT_SEQ_2;
            lcd_init_cmd_wait_cnt = LCD_INIT_CMD_WAIT;
            break;

        case LCD_INIT_SEQ_2:
            /* 4.1msウエイト */
            lcd_init_cmd_wait_cnt--;
            if(lcd_init_cmd_wait_cnt == 0){
                init_seq_cnt = LCD_INIT_SEQ_3;
            }
            break;

        case LCD_INIT_SEQ_3:
            lcd_out_init_command(0x03);         /* LCDファンクションセット */
            lcd_out_init_command(0x03);         /* LCDファンクションセット */
            lcd_out_init_command(0x02);         /* LCDデータを4ビット長に設定 */
            lcd_out_command8bit(0x28);          /* 4bit､2行文､5×7ドットに設定 */
            lcd_out_command8bit(0x08);          /* 表示オフ */
            init_seq_cnt = LCD_INIT_SEQ_4;
            break;

        case LCD_INIT_SEQ_4:
            lcd_out_command8bit(0x01);          /* 表示クリア */
            init_seq_cnt = LCD_INIT_SEQ_5;
            break;

        case LCD_INIT_SEQ_5:
            lcd_out_command8bit(0x06);          /* エントリーモード､インクリメント */
            init_seq_cnt = LCD_INIT_SEQ_6;
            break;

        case LCD_INIT_SEQ_6:
            lcd_state = lcd_state_pending;
            /* LCD表示処理 */
            if (lcd_state == LcdStateOff) {
                lcd_disp_off();
            } else {
                lcd_disp_on();
            }
            init_seq_cnt = LCD_INIT_SEQ_7;
            init_state = LcdInitComplete;
            break;

        case LCD_INIT_SEQ_7:
            init_state = LcdInitComplete;
            break;

        default:
            break;
    }
    lcd_init_seq_cnt = init_seq_cnt;

    return init_state;
}

/*****************************************
 LCDデータ転送 & 表示制御
*****************************************/
void lcd_display( void )
{
    unsigned char row;
    unsigned char col;

    /* 初期化シーケンスが終わっていなければ、表示制御せずに初期化シーケンスの続きを実施 */
    if (lcd_init_seq_cnt != LCD_INIT_SEQ_COMPLETE){
        (void)lcd_init_seq();
        return;
    }

    if (lcd_disp_updating == LCD_FALSE) {
        if (lcd_check_buffer_diff() != LCD_FALSE) {
            lcd_disp_updating = LCD_TRUE;   /* 入力バッファと出力バッファに差異がある場合は */
                                            /* 出力バッファをLCDに転送するための要求フラグをセット */
            lcd_output_cursor = 0;

            /*  入力バッファデータを出力バッファにコピー */
            for (row = 0; row < LCD_ROW_SIZE; row++) {
                for (col = 0; col < LCD_COL_SIZE; col++) {
                    lcd_buf[row][col] = lcd_buf_pending[row][col];
                }
            }
        }else{
            
        }
    } else {
        col = lcd_output_cursor;
        row = 0;
        while(col >= LCD_COL_SIZE){
            row++;
            col-=LCD_COL_SIZE;
        }

        /* 1文字出力 */
        lcd_output_char(lcd_buf[row][col], row, col);

        lcd_output_cursor++;
        if (lcd_output_cursor == (LCD_COL_SIZE * LCD_ROW_SIZE)) { /* 出力バッファ全体の出力が完了したら */
            lcd_disp_updating = LCD_FALSE;   /* 出力バッファのLCD転送要求フラグをクリア */
        }
    }

    if (lcd_state != lcd_state_pending) {
        /* LCDオン・オフの内部状態を更新 */
        lcd_state = lcd_state_pending;
        /* LCD表示処理 */
        if (lcd_state == LcdStateOff) {
            lcd_disp_off();
        } else {
            lcd_disp_on();
        }
    }
}

/*****************************************
 サンプル文字列表示
*****************************************/
void lcd_display_sample(void)
{
    lcd_output_string(&lcd_sample_data[0][0], 0);
    lcd_output_string(&lcd_sample_data[1][0], 1);
}

/*****************************************
 LCD表示開始
*****************************************/
void lcd_on(void)
{
    lcd_state_pending = LcdStateOn;
}

/*****************************************
 LCD表示終了
*****************************************/
void lcd_off(void)
{
    lcd_state_pending = LcdStateOff;
}

/*****************************************
 バッファ差異有無確認
*****************************************/
static unsigned char lcd_check_buffer_diff(void)
{
    unsigned char row;
    unsigned char col;
    unsigned char diff;

    diff = LCD_FALSE;
    /* 差を確認 */
    for (row = 0; row < LCD_ROW_SIZE; row++) {
        for (col = 0; col < LCD_COL_SIZE; col++) {
            if (lcd_buf[row][col] != lcd_buf_pending[row][col]) {
                diff = LCD_TRUE;
                break;
            }
        }
        /*  差がある場合は以降の行の確認をスキップ */
        if (diff == LCD_TRUE){
            break;
        }
    }

    return diff;
}

/*****************************************
 LCD カラム出力データセット
*****************************************/
void lcd_put_string(const char* str)
{
    while (0 != *str) {
        lcd_put_char(*str);
        str++;
    }
}

/*****************************************
 LCD 10進数の数値を表示（char データ版）
*****************************************/
void lcd_put_num_char(unsigned char value, unsigned char zero_padding)
{
    lcd_put_num(value, 3, zero_padding);
}

/*****************************************
 LCD 10進数の数値を表示（short データ版）
*****************************************/
void lcd_put_num_short(unsigned short value, unsigned char zero_padding)
{
    lcd_put_num(value, 5, zero_padding);
}

/*****************************************
 LCD 10進数の数値を表示（表示は2桁以上）
*****************************************/
static void lcd_put_num(unsigned short value, unsigned char digit, unsigned char zero_padding)
{
    unsigned long disp_data;
    unsigned char out_digit;
    unsigned char zero_display;
    unsigned char out_char;
    int i;

    if (digit < 2) {                    /*  表示桁数が1桁は未対応 */
        return;
    }

    disp_data = 0;
    for (i = digit-1; i > 0; i--) {                        /*  10進数(0 - 9)に変換 */
        disp_data = disp_data + (value % 10);
        value = value / 10;                 /*  1の位から変換して，順次高い位へ移動する */
        disp_data = disp_data << 4;         /*  保存するデータも，1の位が最上位になる */
    }

    disp_data = disp_data + (value % 10);

    zero_display = zero_padding;
    for (out_digit = digit; out_digit > 0; out_digit--) {
        out_char = disp_data & 0x0f;        /*  表示データの一番下の桁を抽出 */

        if (zero_display == LCD_TRUE) {            /*  0 表示をするかどうか確認 */
            out_char = out_char + '0';
        } else {
            if ((out_char == 0) && (out_digit != 1)) { /*  上位がすべて0でも，最後の桁は表示する */
                out_char = ' ';             /*  0 表示をしない場合は，空白文字で置き換える */
            } else {
                out_char = out_char + '0';  /*  0 でない場合は，数字に'0'分のオフセットを加算する */
                zero_display = LCD_TRUE;    /*  上位桁で 0 以外が出現した場合は，それ以降の0は表示する */
            }
        }

        lcd_put_char(out_char);             /*  1文字分をバッファに出力 */
        disp_data = disp_data >> 4;         /*  表示用データの桁を移動 */
    }
}

/*****************************************
 LCD CGRAM データセット
*****************************************/
void lcd_set_dot_pattern(unsigned char address, unsigned char* image)
{
    unsigned char i;                        /*  ループカウンタ */

    /*  CGRAM アドレス設定 */
    lcd_out_command8bit(0x40 + (address << 3));

    for (i = 0; i < 8; i++) {
        lcd_out_data8bit(*(image + i));
    }
}

/*****************************************
 LCD 1文字出力
*****************************************/
void lcd_put_char(char out)
{
    unsigned char row;
    unsigned char col;

    /*  文字を入力し, ポインタを移動させる */
    col = lcd_input_cursor;
    row = 0;
    while(col >= LCD_COL_SIZE){
        row++;
        col-=LCD_COL_SIZE;
    }

    lcd_buf_pending[row][col] = out;

    lcd_input_cursor++;
    if (lcd_input_cursor >= LCD_BUF_SIZE) {
        lcd_input_cursor = 0;
    }
}

/*****************************************
 入力データポジションを1行目先頭に移動
*****************************************/
void lcd_set_cursor_home(void)
{
    lcd_input_cursor = 0;
}

/*****************************************
 画面クリア
*****************************************/
void lcd_clear_all(void)
{
    unsigned char row;
    unsigned char col;

    /*  lcd_buf_pending の値をすべて ' ' にする */
    for (row = 0; row < LCD_ROW_SIZE; row++) {
        for (col = 0; col < LCD_COL_SIZE; col++) {
            lcd_buf_pending[row][col] = ' ';
        }
    }
}

/*****************************************
 行クリア
*****************************************/
void lcd_clear_line(unsigned char row)
{
    unsigned char col;

    if (LCD_ROW_SIZE <= row) {
        return;
    }

    /*  lcd_buf_pending の指定行の値をすべて ' ' にする */
    for (col = 0; col < LCD_COL_SIZE; col++) {
        lcd_buf_pending[row][col] = ' ';
    }
}

/*****************************************
 文字出力位置変更
*****************************************/
void lcd_set_cursor(unsigned char row, unsigned char col)
{
    if (LCD_COL_SIZE <= col) {
        col = LCD_COL_SIZE - 1;
    }

    if (LCD_ROW_SIZE <= row) {
        row = LCD_ROW_SIZE - 1;
    }

    /*  入力データポジションに指定された値を代入 */
    lcd_input_cursor = (row * LCD_COL_SIZE) + col;
}

/*****************************************
 LCD表示オン
*****************************************/
static void lcd_disp_on(void)
{
    lcd_out_command8bit(0x0c);                  /*  表示オン､カーソルオフ */
}

/*****************************************
 LCD表示オフ
*****************************************/
static void lcd_disp_off(void)
{
    lcd_out_command8bit(0x08);                  /*  表示オフ */
}

/*****************************************
 ストリングデータ出力
*****************************************/
static void lcd_output_string(const unsigned char* str, unsigned char row)
{
    unsigned char address;
    unsigned char col;

    address = lcd_row_offset_address[row];
    lcd_out_command8bit(address);             /*  先頭アドレスセット */

    for (col = 0; col < LCD_COL_SIZE; col++) {
        if(*str=='\0'){
            break;
        }
        lcd_out_data8bit(*str);                /*  LCDデータ一文字出力 */
        str++;
    }
}

/*****************************************
 キャラクタデータ出力
*****************************************/
static void lcd_output_char(unsigned char data, unsigned char row, unsigned char col)
{
    unsigned char address;

    address = lcd_row_offset_address[row] + col;
    lcd_out_command8bit(address);       /* 書き込み先アドレスセット */
    lcd_out_data8bit(data);             /* LCDデータ一文字出力 */
}

/*****************************************
 LCD初期設定コマンドセット
*****************************************/
static void lcd_out_init_command(unsigned char command)
{
    lcd_out_rs_to_cmd();
    lcd_out_lcd4bit(command & 0x0f);
    lcd_wait_us(50);                    /* 時間制約 処理に 37us かかる */
}

/*****************************************
 LCDコマンド出力
*****************************************/
static void lcd_out_command8bit(unsigned char command)
{
    unsigned char upper4bit;
    unsigned char lower4bit;

    lcd_out_rs_to_cmd();

    upper4bit = (command >> 4) & 0x0f;
    lcd_out_lcd4bit(upper4bit);         /* コマンドデータ上位4ビットを出力 */

    lower4bit = command & 0x0f;
    lcd_out_lcd4bit(lower4bit);         /* コマンドデータ下位4ビットを出力 */
    lcd_wait_us(50);                    /* 時間制約 処理に 37us かかる */
}

/*****************************************
 LCDデータ出力
*****************************************/
static void lcd_out_data8bit(unsigned char data)
{
    unsigned char upper4bit;
    unsigned char lower4bit;

    lcd_out_rs_to_data();

    upper4bit = (data >> 4) & 0x0f;
    lcd_out_lcd4bit(upper4bit);         /* データ上位4ビットを出力 */

    lower4bit = data & 0x0f;
    lcd_out_lcd4bit(lower4bit);         /* データ下位4ビットを出力 */
    lcd_wait_us(50);                    /* 時間制約 処理に 37us かかる */
}



/*****************************************
 LCD データポートに4ビットデータを出力する
*****************************************/
static void lcd_out_lcd4bit(unsigned char outdata)
{
    unsigned char data_without_e;
    unsigned char data_with_e;

    data_without_e = LCD_PORT_DATA_REG;
    data_without_e &= (~LCD_PORT_DATA_BIT);
    data_without_e &= (~LCD_PORT_E_BIT);
    data_without_e |= (outdata & LCD_PORT_DATA_BIT); /* ポートの下位4bitをデータとして使っていることを前提にしちゃっている */

    data_with_e = data_without_e | LCD_PORT_E_BIT;

    LCD_PORT_DATA_REG = data_without_e; /* データ書き込み */
    LCD_PORT_DATA_REG = data_with_e;    /* Eを1にする */
    lcd_wait_us(1); /* 時間制約 140ns以上空ける */
    LCD_PORT_DATA_REG = data_without_e; /* Eを0にする */
    lcd_wait_us(1); /* 時間制約 10ns以上空ける */
}

/*****************************************
 RSをデータ(1)に設定する
*****************************************/
static void lcd_out_rs_to_data(void)
{
    LCD_PORT_DATA_REG |= LCD_PORT_RS_BIT;
}

/*****************************************
 RSをコマンド(0)に設定する
*****************************************/
static void lcd_out_rs_to_cmd(void)
{
    LCD_PORT_DATA_REG &= (~LCD_PORT_RS_BIT);
}

/*****************************************
 usウェイト
*****************************************/
static void lcd_wait_us(unsigned short us)
{
    int iCnt;
    /* 16MHzなので、1ループnop＋分岐で2命令 * 8ループ ＝ 1us */
    for(iCnt = 0; iCnt < (8*us); iCnt++ ) {
        asm volatile("nop\n"::);
    }
}
