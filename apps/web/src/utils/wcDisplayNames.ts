import type { Locale } from '@/i18n';
import { formatI18n } from '@/i18n';

type NameMap = Partial<Record<Locale, string>>;

/** FIFA World Cup 2026 team display names by locale (falls back to API/admin name). */
const TEAM_NAMES: Record<string, NameMap> = {
  mexico: { ru: 'Мексика', es: 'México', ua: 'Мексика', fr: 'Mexique', de: 'Mexiko' },
  'south-africa': { ru: 'ЮАР', es: 'Sudáfrica', ua: 'ПАР', fr: 'Afrique du Sud', de: 'Südafrika' },
  'south-korea': { ru: 'Южная Корея', es: 'Corea del Sur', ua: 'Південна Корея', fr: 'Corée du Sud', de: 'Südkorea' },
  czechia: { ru: 'Чехия', es: 'Chequia', ua: 'Чехія', fr: 'Tchéquie', de: 'Tschechien' },
  canada: { ru: 'Канада', es: 'Canadá', ua: 'Канада', fr: 'Canada', de: 'Kanada' },
  'bosnia-herzegovina': { ru: 'Босния и Герцеговина', es: 'Bosnia y Herzegovina', ua: 'Боснія і Герцеговина', fr: 'Bosnie-Herzégovine', de: 'Bosnien und Herzegowina' },
  qatar: { ru: 'Катар', es: 'Catar', ua: 'Катар', fr: 'Qatar', de: 'Katar' },
  switzerland: { ru: 'Швейцария', es: 'Suiza', ua: 'Швейцарія', fr: 'Suisse', de: 'Schweiz' },
  brazil: { ru: 'Бразилия', es: 'Brasil', ua: 'Бразилія', fr: 'Brésil', de: 'Brasilien' },
  morocco: { ru: 'Марокко', es: 'Marruecos', ua: 'Марокко', fr: 'Maroc', de: 'Marokko' },
  haiti: { ru: 'Гаити', es: 'Haití', ua: 'Гаїті', fr: 'Haïti', de: 'Haiti' },
  scotland: { ru: 'Шотландия', es: 'Escocia', ua: 'Шотландія', fr: 'Écosse', de: 'Schottland' },
  usa: { ru: 'США', es: 'Estados Unidos', ua: 'США', fr: 'États-Unis', de: 'USA' },
  paraguay: { ru: 'Парагвай', es: 'Paraguay', ua: 'Парагвай', fr: 'Paraguay', de: 'Paraguay' },
  australia: { ru: 'Австралия', es: 'Australia', ua: 'Австралія', fr: 'Australie', de: 'Australien' },
  turkiye: { ru: 'Турция', es: 'Turquía', ua: 'Туреччина', fr: 'Turquie', de: 'Türkei' },
  germany: { ru: 'Германия', es: 'Alemania', ua: 'Німеччина', fr: 'Allemagne', de: 'Deutschland' },
  curacao: { ru: 'Кюрасао', es: 'Curazao', ua: 'Кюрасао', fr: 'Curaçao', de: 'Curaçao' },
  'ivory-coast': { ru: 'Кот-д\'Ивуар', es: 'Costa de Marfil', ua: 'Кот-д\'Івуар', fr: 'Côte d\'Ivoire', de: 'Elfenbeinküste' },
  ecuador: { ru: 'Эквадор', es: 'Ecuador', ua: 'Еквадор', fr: 'Équateur', de: 'Ecuador' },
  netherlands: { ru: 'Нидерланды', es: 'Países Bajos', ua: 'Нідерланди', fr: 'Pays-Bas', de: 'Niederlande' },
  japan: { ru: 'Япония', es: 'Japón', ua: 'Японія', fr: 'Japon', de: 'Japan' },
  sweden: { ru: 'Швеция', es: 'Suecia', ua: 'Швеція', fr: 'Suède', de: 'Schweden' },
  tunisia: { ru: 'Тунис', es: 'Túnez', ua: 'Туніс', fr: 'Tunisie', de: 'Tunesien' },
  belgium: { ru: 'Бельгия', es: 'Bélgica', ua: 'Бельгія', fr: 'Belgique', de: 'Belgien' },
  egypt: { ru: 'Египет', es: 'Egipto', ua: 'Єгипет', fr: 'Égypte', de: 'Ägypten' },
  iran: { ru: 'Иран', es: 'Irán', ua: 'Іран', fr: 'Iran', de: 'Iran' },
  'new-zealand': { ru: 'Новая Зеландия', es: 'Nueva Zelanda', ua: 'Нова Зеландія', fr: 'Nouvelle-Zélande', de: 'Neuseeland' },
  spain: { ru: 'Испания', es: 'España', ua: 'Іспанія', fr: 'Espagne', de: 'Spanien' },
  'cape-verde': { ru: 'Кабо-Верде', es: 'Cabo Verde', ua: 'Кабо-Верде', fr: 'Cap-Vert', de: 'Kap Verde' },
  'saudi-arabia': { ru: 'Саудовская Аравия', es: 'Arabia Saudita', ua: 'Саудівська Аравія', fr: 'Arabie saoudite', de: 'Saudi-Arabien' },
  uruguay: { ru: 'Уругвай', es: 'Uruguay', ua: 'Уругвай', fr: 'Uruguay', de: 'Uruguay' },
  france: { ru: 'Франция', es: 'Francia', ua: 'Франція', fr: 'France', de: 'Frankreich' },
  senegal: { ru: 'Сенегал', es: 'Senegal', ua: 'Сенегал', fr: 'Sénégal', de: 'Senegal' },
  norway: { ru: 'Норвегия', es: 'Noruega', ua: 'Норвегія', fr: 'Norvège', de: 'Norwegen' },
  iraq: { ru: 'Ирак', es: 'Irak', ua: 'Ірак', fr: 'Irak', de: 'Irak' },
  argentina: { ru: 'Аргентина', es: 'Argentina', ua: 'Аргентина', fr: 'Argentine', de: 'Argentinien' },
  algeria: { ru: 'Алжир', es: 'Argelia', ua: 'Алжир', fr: 'Algérie', de: 'Algerien' },
  austria: { ru: 'Австрия', es: 'Austria', ua: 'Австрія', fr: 'Autriche', de: 'Österreich' },
  jordan: { ru: 'Иордания', es: 'Jordania', ua: 'Йорданія', fr: 'Jordanie', de: 'Jordanien' },
  portugal: { ru: 'Португалия', es: 'Portugal', ua: 'Португалія', fr: 'Portugal', de: 'Portugal' },
  colombia: { ru: 'Колумбия', es: 'Colombia', ua: 'Колумбія', fr: 'Colombie', de: 'Kolumbien' },
  'dr-congo': { ru: 'ДР Конго', es: 'RD Congo', ua: 'ДР Конго', fr: 'RD Congo', de: 'DR Kongo' },
  uzbekistan: { ru: 'Узбекистан', es: 'Uzbekistán', ua: 'Узбекистан', fr: 'Ouzbékistan', de: 'Usbekistan' },
  england: { ru: 'Англия', es: 'Inglaterra', ua: 'Англія', fr: 'Angleterre', de: 'England' },
  croatia: { ru: 'Хорватия', es: 'Croacia', ua: 'Хорватія', fr: 'Croatie', de: 'Kroatien' },
  ghana: { ru: 'Гана', es: 'Ghana', ua: 'Гана', fr: 'Ghana', de: 'Ghana' },
  panama: { ru: 'Панама', es: 'Panamá', ua: 'Панама', fr: 'Panama', de: 'Panama' },
};

/** Strip admin/API prefixes like "KR South Korea" → "South Korea". */
export function cleanTeamDisplayName(name: string | undefined): string {
  if (!name?.trim()) return '';
  return name.trim().replace(/^[A-Z]{2,3}\s+(?=[A-Za-z])/u, '');
}

export function getLocalizedTeamName(
  teamId: string | undefined,
  fallbackName: string | undefined,
  locale: Locale
): string {
  if (!teamId) return cleanTeamDisplayName(fallbackName);
  const localized = TEAM_NAMES[teamId.toLowerCase()]?.[locale];
  if (localized) return localized;
  const cleaned = cleanTeamDisplayName(fallbackName);
  if (cleaned) return cleaned;
  const fromId = teamId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return fromId;
}

export function getLocalizedGroupLabel(
  groupId: string | undefined,
  fallbackLabel: string | undefined,
  locale: Locale,
  groupLabelTemplate: string
): string {
  if (!groupId) return fallbackLabel?.trim() || '';
  const letter = groupId.replace(/^group-/i, '').toUpperCase();
  if (letter.length === 1) {
    return formatI18n(groupLabelTemplate, { letter });
  }
  return fallbackLabel?.trim() || groupId;
}
