import type { BlockDefinitionVersion, FieldDefinition, JsonValue, RepeaterDefinition } from '@blockdesign/contracts';
import { DESIGN_SYSTEM } from './index.ts';

const field = (
  fieldId: string,
  key: string,
  label: string,
  type: FieldDefinition['type'],
  nodeId: string,
  operation: FieldDefinition['mappingTarget']['operation'] = 'text',
  defaultValue: JsonValue = '',
  required = false,
): FieldDefinition => ({ fieldId, key, label, type, required, defaultValue, mappingTarget: { nodeId, operation } });

const answerFields = (group: string): FieldDefinition[] => [
  field(`${group}.question`, 'question', 'Soru', 'text', 'accordion-question', 'text', 'Yeni soru', true),
  field(`${group}.answer`, 'answer', 'Yanıt', 'textarea', 'accordion-answer', 'text', 'Yanıtınızı buraya yazın.', true),
];

const faqRepeater: RepeaterDefinition = {
  repeaterId: 'faq.items', key: 'items', label: 'Sorular', minItems: 0, maxItems: 30, nesting: 'none', itemFields: answerFields('faq.items'),
};

export const faqDefinition: BlockDefinitionVersion = {
  ref: { id: 'blockdesign.faq', version: '1.0.0' },
  designSystemRef: DESIGN_SYSTEM,
  name: 'Sık sorulan sorular',
  description: 'İki sütunlu, erişilebilir akordiyon.',
  category: 'İçerik',
  preview: 'faq',
  componentTemplate: { type: 'wrapper', components: [] },
  fields: [
    field('faq.title', 'title', 'Başlık', 'text', 'faq-title', 'text', 'Merak edilenler', true),
    field('faq.description', 'description', 'Açıklama', 'textarea', 'faq-description', 'text', 'Yolculuğun hakkında aklına takılanlara yanıt bul.', true),
    field('faq.eyebrow', 'eyebrow', 'Üst başlık', 'text', 'faq-eyebrow', 'text', 'Yardım merkezi'),
  ],
  repeaters: [faqRepeater],
  defaultData: {
    title: 'Merak edilenler',
    description: 'Yolculuğun hakkında aklına takılanlara yanıt bul.',
    eyebrow: 'Yardım merkezi',
    items: [
      { question: 'Platform kimler için?', answer: 'Kendi sayfalarını tasarlayan ekipler ve mevcut ürününe görsel bir editör eklemek isteyen geliştiriciler için.', __id: 'seed-faq-1' },
      { question: 'Editörü kendi backend’ime bağlayabilir miyim?', answer: 'Evet. Saklama ve içerik kaynaklarını kendi adapter’larınla sağlayabilir, Go örnek sunucuyu kullanmak zorunda kalmazsın.', __id: 'seed-faq-2' },
      { question: 'Tasarımım farklı ekranlarda nasıl görünür?', answer: 'Responsive önizleme sayesinde geniş, tablet ve dar ekran düzenini düzenleme sırasında kontrol edebilirsin.', __id: 'seed-faq-3' },
    ],
  },
  stylePolicy: { allowedProperties: ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'padding'], structuralEdits: true },
  sourceCapabilities: { modes: ['manual', 'selection', 'query'], target: ['block', 'field', 'repeater'] },
  archived: false,
};

export const bannerDefinition: BlockDefinitionVersion = {
  ref: { id: 'blockdesign.banner', version: '1.0.0' },
  designSystemRef: DESIGN_SYSTEM,
  name: 'Görsel banner',
  description: 'Başlık, açıklama ve opsiyonel bağlantı.',
  category: 'Tanıtım',
  preview: 'banner',
  componentTemplate: { type: 'wrapper', components: [] },
  fields: [
    field('banner.eyebrow', 'eyebrow', 'Üst başlık', 'text', 'banner-eyebrow', 'text', 'Yeni koleksiyon'),
    field('banner.title', 'title', 'Başlık', 'text', 'banner-title', 'text', 'Her yolculuk bir fikirle başlar', true),
    field('banner.description', 'description', 'Açıklama', 'textarea', 'banner-description', 'text', 'Fikirlerini kendi hikâyeni anlatan sayfalara dönüştür.', true),
    field('banner.image', 'image', 'Görsel URL’si', 'image', 'banner-image', 'attribute', ''),
    field('banner.alt', 'alt', 'Görsel alt metni', 'text', 'banner-image', 'attribute', ''),
    field('banner.buttonText', 'buttonText', 'Bağlantı metni', 'text', 'banner-button', 'text', 'Daha fazla bilgi'),
    field('banner.url', 'url', 'Bağlantı adresi', 'url', 'banner-button', 'attribute', ''),
  ],
  repeaters: [],
  defaultData: { eyebrow: 'Yeni koleksiyon', title: 'Her yolculuk bir fikirle başlar', description: 'Fikirlerini kendi hikâyeni anlatan sayfalara dönüştür.', image: '', alt: '', buttonText: 'Daha fazla bilgi', url: '' },
  stylePolicy: { allowedProperties: ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'padding'], structuralEdits: true },
  sourceCapabilities: { modes: ['manual', 'selection', 'query'], target: ['block', 'field'] },
  archived: false,
};

const sliderFields: FieldDefinition[] = [
  field('slider.image', 'image', 'Görsel URL’si', 'image', 'slider-image', 'attribute', ''),
  field('slider.alt', 'alt', 'Görsel alt metni', 'text', 'slider-image', 'attribute', ''),
  field('slider.title', 'title', 'Başlık', 'text', 'slider-title', 'text', 'Yeni slayt'),
  field('slider.description', 'description', 'Açıklama', 'textarea', 'slider-description', 'text', ''),
  field('slider.url', 'url', 'Bağlantı', 'url', 'slider-link', 'attribute', ''),
];

export const sliderDefinition: BlockDefinitionVersion = {
  ref: { id: 'blockdesign.slider', version: '1.0.0' }, designSystemRef: DESIGN_SYSTEM,
  behavior: { pluginId:'blockdesign.slider',settings:[
    {fieldId:'slider.autoplay',key:'autoplay',label:'Otomatik oynat',type:'boolean',required:false,defaultValue:false,mappingTarget:{nodeId:'slider-root',operation:'attribute',property:'data-bd-autoplay'}},
    {fieldId:'slider.interval',key:'interval',label:'Slayt süresi (milisaniye)',type:'number',required:true,defaultValue:5000,min:1000,max:60000,mappingTarget:{nodeId:'slider-root',operation:'attribute',property:'data-bd-interval'}},
    {fieldId:'slider.loop',key:'loop',label:'Son slayttan başa dön',type:'boolean',required:false,defaultValue:true,mappingTarget:{nodeId:'slider-root',operation:'attribute',property:'data-bd-loop'}}
  ] },
  name: 'Görsel slider', description: 'Bağımsız kontrolleri olan görsel slayt listesi.', category: 'Medya', preview: 'slider',
  componentTemplate: { type: 'wrapper', components: [] },
  fields: [],
  repeaters: [{ repeaterId: 'slider.slides', key: 'slides', label: 'Slaytlar', minItems: 1, maxItems: 20, nesting: 'none', itemFields: sliderFields }],
  defaultData: { slides: [
    { __id: 'seed-slide-1', image: '', alt: 'Kıyı manzarası', title: 'Yeni bir rota', description: 'Her sayfada kendi hikâyeni anlat.', url: '#' },
    { __id: 'seed-slide-2', image: '', alt: 'Tasarım masası', title: 'Fikirden tasarıma', description: 'Bloklarını bir araya getir ve paylaş.', url: '#' },
  ] },
  stylePolicy: { allowedProperties: ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'padding'], structuralEdits: true },
  sourceCapabilities: { modes: ['manual', 'selection', 'query'], target: ['block', 'repeater'] }, archived: false,
};

const cardFields: FieldDefinition[] = [
  field('cards.title', 'title', 'Başlık', 'text', 'card-title', 'text', 'Yeni kart', true),
  field('cards.body', 'body', 'Açıklama', 'textarea', 'card-body', 'text', ''),
  field('cards.image', 'image', 'Görsel', 'image', 'card-image', 'attribute', ''),
  field('cards.url', 'url', 'Bağlantı', 'url', 'card-link', 'attribute', ''),
];

export const cardsDefinition: BlockDefinitionVersion = {
  ref: { id: 'blockdesign.cards', version: '1.0.0' },
  designSystemRef: DESIGN_SYSTEM,
  name: 'İçerik kartları',
  description: 'Görsel ve bağlantı içeren, kaynak kayıtlarıyla beslenebilen kart listesi.',
  category: 'İçerik',
  preview: 'cards',
  componentTemplate: { type: 'wrapper', components: [] },
  fields: [],
  repeaters: [{ repeaterId: 'cards.items', key: 'items', label: 'Kartlar', minItems: 0, maxItems: 30, nesting: 'none', itemFields: cardFields }],
  defaultData: { items: [
    { __id: 'seed-card-1', title: 'Yeni tasarım sistemi', body: 'Bağımsız stillerle yeni bir sayfa ailesi oluştur.', image: '', url: '/tasarim' },
    { __id: 'seed-card-2', title: 'Görsel editör', body: 'Blokları sayfaya yerleştir ve düzenle.', image: '', url: '/demo/editor' },
  ] },
  stylePolicy: { allowedProperties: ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'padding'], structuralEdits: true },
  sourceCapabilities: { modes: ['manual', 'selection', 'query'], target: ['block', 'repeater'] },
  archived: false,
};

export const demoDefinitions = [faqDefinition, bannerDefinition, sliderDefinition, cardsDefinition] as const;

export function emptyInstanceData(definition: BlockDefinitionVersion): Record<string, JsonValue> {
  return structuredClone(definition.defaultData);
}
