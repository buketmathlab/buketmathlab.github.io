import { describe, expect, it } from 'vitest';
import { BASLIK, ILKELER, KAPANIS, PARAGRAFLAR } from './durustluk-metni';

const tum = [BASLIK, ...PARAGRAFLAR, ...ILKELER, KAPANIS].join(' ');

describe('Dürüst çalışma ilkemiz', () => {
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
    expect(KAPANIS).toMatch(/kusur değil/);
  });

  it('ilkeler birinci tekil şahıs, paragraflar öğrenciye "sen" diye', () => {
    for (const i of ILKELER) expect(i).toMatch(/(ım|im|mem|mam)[.;]/);
    expect(PARAGRAFLAR.join(' ')).toMatch(/kendi emeğinle/);
  });

  it('önce çözümlü cevap anahtarı, sonra öğretmen (öğretmenin düzeltmesi)', () => {
    const son = ILKELER[2] ?? '';
    expect(son).toMatch(/gönderdikten sonra/);
    expect(son.indexOf('çözümlü cevap anahtarı')).toBeGreaterThan(-1);
    expect(son.indexOf('çözümlü cevap anahtarı')).toBeLessThan(son.indexOf('öğretmenime'));
  });

  it('kısa kalıyor: telefonda bir kart', () => {
    expect(tum.length).toBeLessThan(1200);
  });
});
