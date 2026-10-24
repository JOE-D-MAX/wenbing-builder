import { blockStudioEnglish } from './block-studio.en';
import { blockComponentsEnglish } from './block-components.en';
import { blockCatalogEnglish } from './block-catalog.en';
import { siteHomeEnglish } from './site-home.en';
import { apiEnglish } from './api.en';
import { errorEnglish } from './errors.en';
import { manualEnglish } from './manual.en';
import { checkoutEnglish } from './checkout.en';

export const englishMessages: Record<string, string> = {
  ...blockStudioEnglish, ...blockComponentsEnglish, ...blockCatalogEnglish, ...siteHomeEnglish, ...apiEnglish, ...manualEnglish, ...checkoutEnglish, ...errorEnglish,
  '文炳建站': 'Wenbing',
  '文炳建站 · 让你的故事成为网站': 'Wenbing · Turn your story into a website',
  '选择制作方式 · 文炳建站': 'Choose how to create · Wenbing',
  '模块制作 · 文炳建站': 'Block builder · Wenbing',
  'API 制作 · 文炳建站': 'API studio · Wenbing',
  '模板制作 · 文炳建站': 'Template studio · Wenbing',
  '订单与交付 · 文炳建站': 'Order and delivery · Wenbing',
};
