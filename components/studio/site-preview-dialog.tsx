'use client';
import { useStudioI18n } from './studio-i18n';

import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export type SitePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  html: string;
  device: 'desktop' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
  onDownload: () => void;
  onCustomize?: () => void;
};

// Load the dialog machinery only when someone actually generates a preview.
export default function SitePreviewDialog({open,onOpenChange,name,html,device,onDeviceChange,onDownload,onCustomize}:SitePreviewDialogProps) {
  const { t } = useStudioI18n();
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="site-preview-dialog">
      <DialogHeader>
        <DialogTitle>{t('{{name}} · 免费模板预览', { name })}</DialogTitle>
        <DialogDescription>{t("这是根据你的资料生成的完整模板。当前尚未发布，没有公开网址。")}</DialogDescription>
      </DialogHeader>
      <div className="preview-toolbar">
        <div className="device-switch" aria-label={t("预览尺寸")}>
          <button aria-pressed={device==='desktop'} onClick={()=>onDeviceChange('desktop')}>{t("宽屏")}</button>
          <button aria-pressed={device==='mobile'} onClick={()=>onDeviceChange('mobile')}>{t("手机")}</button>
        </div>
        <span>{t("完整预览 · 免费")}</span>
      </div>
      <div className={'preview-canvas '+device}>
        <iframe title={t("完整模板网站预览")} srcDoc={html} sandbox="" referrerPolicy="no-referrer"/>
      </div>
      <div className="preview-dialog-footer">
        <button className="quiet-link" onClick={()=>onOpenChange(false)}>{t("返回调整资料")}</button>
        {onCustomize && <button className="btn outline" onClick={onCustomize}>{t("用模块继续制作")}</button>}
        <button className="btn dark" onClick={onDownload}>{t("下载网站")}<ArrowRight size={17}/></button>
      </div>
    </DialogContent>
  </Dialog>;
}
