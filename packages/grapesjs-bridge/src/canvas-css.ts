import postcss from 'postcss';

/** Studio's page scaffold is not part of an independently imported design system.
 * Also removes scaffold rules persisted by older canvas snapshots. Component
 * classes and user-authored rules stay intact, including responsive overrides.
 */
export function canvasCssForDesignSystem(css: string, studioDefaults: boolean): string {
  if (studioDefaults) return css;
  const root = postcss.parse(css);
  root.walkRules(rule => {
    const selectors=rule.selectors.map(s=>s.trim());
    const scaffold=selectors.every(s=>['*','html','body','img','[data-bd-template-slot="content-main"]'].includes(s));
    if(!scaffold)return;
    rule.walkDecls(decl=>{
      const value=decl.value.trim(),property=decl.prop;
      const page=selectors.every(s=>s==='html'||s==='body');
      const slot=selectors.every(s=>s==='[data-bd-template-slot="content-main"]');
      const defaultPadding=/^padding(?:-(?:top|right|bottom|left))?$/.test(property)&&(page?['48px','16px'].includes(value):slot?['24px 32px','24px','32px'].includes(value):false);
      const defaultPage=page&&((property==='min-height'&&value==='100%')||(property==='margin'&&value==='0')||(property==='background'&&['#fff','#ffffff','white'].includes(value))||(property==='color'&&value==='#22261f')||(property==='font-family'&&value.startsWith('"Segoe UI",')));
      const defaultSlot=slot&&((property==='min-height'&&value==='420px')||(property==='max-width'&&value==='1120px')||(/^margin/.test(property)&&['0 auto','0','0px','auto'].includes(value)));
      if(defaultPadding||defaultPage||defaultSlot||(selectors[0]==='*'&&property==='box-sizing'&&value==='border-box')||(selectors[0]==='img'&&property==='max-width'&&value==='100%'))decl.remove();
    });
    if(!rule.nodes.length)rule.remove();
  });
  root.walkAtRules(rule => { if (rule.nodes?.length === 0) rule.remove(); });
  return root.toString();
}
