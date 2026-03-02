#include "type_common.h"

#include <avr/io.h>

/* 関数プロトタイプ宣言 */
static void wait_1ms(void);
static void init_timer(void);

int main(void)
{
	int cnt;
	/* ポート初期化 */
	DDRD   = (U1)0xFFU; /* DDRD   :PORTD0-7出力設定 */
	PORTD  = (U1)0x00U; /* PORTD  :PORTD0-7出力Low  */
	
	/* タイマ初期化 */
	init_timer();

	cnt=0;
	while(1)
	{
		/* 1ms経過まで待機する */
		wait_1ms();
		cnt++;
		
		if(cnt>1000){
			cnt=0;
			/* PORTD0を反転出力する */
			PORTD ^= (U1)_BV(PORTD0);
		}
	}
	
	return 0;
}

/* 1msカウント */
static void wait_1ms(void)
{
	/* 1ms経過判断(TIFR0.OCF0Aのbit値) */
	while((TIFR0 & (U1)_BV(OCF0A)) == (U1)0U);
	
	/* TIFR0.OCF0Aを0クリアする */
	TIFR0 = (U1)_BV(OCF0A);
	
	return;
}

/* タイマ初期化 */
static void init_timer(void)
{
	TCCR0A = (U1)0x02U;	 /* TCCR0A :OC0A,OC0B出力使用しない */
	OCR0A  = (U1)0xF9U;	 /* OCR0A  :250カウント */
	TCNT0  = (U1)0x00U;	 /* TCNT0  :カウント初期値0 */
	TCCR0B = (U1)0x03U;	 /* TCCR0B :64分周, CTCモード */
	/* TCCR0B.CS0設定後にタイマ始動。カウントスタート */
	
	return;
}