# Gates "Belt Slip Safety Factor" grafiklerini doğal çözünürlükte çıkarır.
import pymupdf as fitz, glob, os, json, sys
S=sys.argv[1]
def gruplar(p):
    rs=[]
    for x in p.get_images(full=True):
        for r in p.get_image_rects(x[0]): rs.append((r,x[0]))
    rs.sort(key=lambda a:(round(a[0].x0,1),round(a[0].x1,1),a[0].y0))
    g=[]
    for r,xr in rs:
        if g and abs(g[-1][-1][0].x0-r.x0)<0.5 and abs(g[-1][-1][0].x1-r.x1)<0.5 and abs(g[-1][-1][0].y1-r.y0)<0.6: g[-1].append((r,xr))
        else: g.append([(r,xr)])
    return g
out={}
for f in sorted(glob.glob('docs/gates-reports/pdf/*.pdf')):
    d=fitz.open(f); ad=os.path.basename(f).split('_')[0]+'_'+os.path.basename(f).split('_')[1]
    for i in range(d.page_count):
        p=d[i]
        for g in gruplar(p):
            R=fitz.Rect(g[0][0].x0,g[0][0].y0,g[-1][0].x1,g[-1][0].y1)
            w0=d.extract_image(g[0][1])['width']
            if w0<300: continue
            dpi=w0/R.width*72
            pix=p.get_pixmap(clip=R,matrix=fitz.Matrix(dpi/72,dpi/72))
            W,H=pix.width,pix.height; s=pix.samples; n=pix.n
            pembe=sum(1 for y in range(H//2,H,3) for x in range(0,W,3)
                      if s[(y*W+x)*n]>235 and 185<s[(y*W+x)*n+1]<225 and 185<s[(y*W+x)*n+2]<225)
            if pembe>300:
                yol=f'{S}/{ad}.png'; pix.save(yol)
                out[ad]={'pdf':os.path.basename(f),'sayfa':i+1,'rect':[R.x0,R.y0,R.x1,R.y1],'dpi':round(dpi,1),'W':W,'H':H,'serit':len(g)}
                print(ad,'sayfa',i+1,'şerit',len(g),'dpi',round(dpi,1),W,'x',H)
json.dump(out,open(f'{S}/grafikler.json','w'),indent=1)
