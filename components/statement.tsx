import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
export function Statement({text}:{text:string}){
  const formatted=text.replace(/\$\$\$([\s\S]*?)\$\$\$/g,(_match,math:string)=>math.includes('\n')?`$$\n${math}\n$$`:`$${math}$`);
  return <div className="statement"><Markdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{throwOnError:false,trust:false}]]} components={{a:({children,href})=><a href={href} target="_blank" rel="noreferrer">{children} ↗</a>,img:({alt,src})=><a href={typeof src==='string'?src:undefined} target="_blank" rel="noreferrer">[Illustration: {alt||'view source image'} ↗]</a>}}>{formatted}</Markdown></div>;
}
