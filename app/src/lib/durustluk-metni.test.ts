import { describe, expect, it } from 'vitest';
import { BASLIK, ILKELER, PARAGRAFLAR } from './durustluk-metni';

const tum = [BASLIK, ...PARAGRAFLAR, ...ILKELER].join(' ');

describe('Yapay değil, kendi zekâm (dürüstlük kartı)', () => {
  it('başlık öğretmenin seçtiği cümle', () => {
    expect(BASLIK).toBe('Yapay değil, kendi zekâm');
  });

  it('öğretmenin istediği üç fikri taşıyor: kısa yol yok, puan yol gösterir, eksik görünür', () => {
    expect(tum).toMatch(/Yapay zekâ/);
    expect(tum).toMatch(/çalışma programı/);
    expect(tum).toMatch(/eksiklerini gizler/);
    expect(tum).toMatch(/dürüst/i);
    expect(tum).toMatch(/karakterini/);
  });

  it('tehdit ve suçlama dili yok (yaptırım ödev gönderme ekranında)', () => {
    for (const yasak of [
      /ceza/i,
      /yakala/i,
      /kopya çek/i,
      /kabul edilmez/i,
      /tembel/i,
      /yalancı/i,
    ]) {
      expect(tum).not.toMatch(yasak);
    }
  });

  it('yanlış ve boş suç değil, öğrenmenin parçası', () => {
    expect(ILKELER.join(' ')).toMatch(/yanlış yapmaktan ya da boş bırakmaktan çekinmem/);
  });

  it('ilkeler birinci tekil şahıs, paragraflar öğrenciye "sen" diye', () => {
    for (const i of ILKELER) expect(i).toMatch(/(ım|im|mem|mam)[.;]/);
    expect(PARAGRAFLAR.join(' ')).toMatch(/kendi emeğinle/);
  });

  it('üçüncü ilke öğretmenin kendi cümlesi', () => {
    expect(ILKELER[2]).toBe(
      'Ödevimi gönderdikten sonra takıldığım soruları çözümlü cevap anahtarından incelerim; ' +
        'anlamadığım yeri öğretmenime sorarım.',
    );
  });

  it('kısa kalıyor: telefonda bir kart', () => {
    expect(tum.length).toBeLessThan(1200);
  });
});
