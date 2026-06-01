import { set, get, del, keys } from "idb-keyval";
import { jsPDF } from "jspdf";

const form = document.getElementById("reportForm");
const reportsList = document.getElementById("reportsList");
const tpl = document.getElementById("reportItemTpl");
const photosInput = document.getElementById("photos");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");
const closeModal = document.getElementById("closeModal");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const exportAllBtn = document.getElementById("exportAll");
const shareLatestBtn = document.getElementById("shareLatest");
const downloadJsonBtn = document.getElementById("downloadJson");
const downloadPdfBtn = document.getElementById("downloadPdf");

// logo controls
const siteLogo = document.getElementById("siteLogo");
const logoInput = document.getElementById("logoInput");
const removeLogoBtn = document.getElementById("removeLogo");
const LOGO_KEY = ID_PREFIX + "logo";

const ID_PREFIX = "rdobra-";

 // set default date to today
document.getElementById("date").value = new Date().toISOString().slice(0,10);

// load stored logo if available
async function loadLogo(){
  try{
    const stored = await get(LOGO_KEY);
    if(stored && stored.data){
      siteLogo.src = stored.data;
      siteLogo.classList.remove("hidden");
    }else{
      siteLogo.src = "";
      siteLogo.classList.add("hidden");
    }
  }catch(e){
    console.error("loadLogo", e);
  }
}
loadLogo();

logoInput.addEventListener("change", async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=> {
    const data = reader.result;
    await set(LOGO_KEY, { name: f.name, type: f.type, data });
    siteLogo.src = data;
    siteLogo.classList.remove("hidden");
  };
  reader.readAsDataURL(f);
});

removeLogoBtn.addEventListener("click", async ()=>{
  if(!confirm("Remover logo?")) return;
  await del(LOGO_KEY);
  siteLogo.src = "";
  siteLogo.classList.add("hidden");
  logoInput.value = "";
});

async function listReports(){
  reportsList.innerHTML = "";
  const allKeys = await keys();
  const reportKeys = allKeys.filter(k => typeof k === "string" && k.startsWith(ID_PREFIX))
    .sort().reverse();
  for(const k of reportKeys){
    const data = await get(k);
    const item = tpl.content.cloneNode(true);
    item.querySelector(".proj").textContent = data.project || "Sem projeto";
    item.querySelector(".date").textContent = data.date || "";
    item.querySelector(".weather").textContent = (data.weather || "");
    item.querySelector(".crew").textContent = (data.crew || "");
    const li = item.querySelector("li");
    li.dataset.key = k;

    li.querySelector("button.view").addEventListener("click", ()=> openModal(data, k));
    li.querySelector("button.share").addEventListener("click", ()=> doShare(data));
    li.querySelector("button.delete").addEventListener("click", async ()=>{
      if(confirm("Excluir relatório?")){ await del(k); listReports(); }
    });

    reportsList.appendChild(li);
  }
  if(reportKeys.length===0){
    reportsList.innerHTML = "<div style='color:#666;padding:8px'>Nenhum relatório salvo</div>";
  }
}

function readFilesAsDataURL(files){
  const promises = [];
  for(const f of files){
    promises.push(new Promise(res=>{
      const r = new FileReader();
      r.onload = ()=> res({name:f.name,type:f.type,data:r.result});
      r.readAsDataURL(f);
    }));
  }
  return Promise.all(promises);
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  saveBtn.disabled = true;
  const formData = new FormData(form);
  const obj = {
    date: formData.get("date"),
    weather: formData.get("weather"),
    project: formData.get("project"),
    progress: formData.get("progress"),
    issues: formData.get("issues"),
    crew: formData.get("crew"),
    equipment: formData.get("equipment"),
    createdAt: new Date().toISOString()
  };

  const files = photosInput.files;
  if(files && files.length>0){
    try{
      const imgs = await readFilesAsDataURL(files);
      obj.photos = imgs;
    }catch(err){
      console.error(err);
    }
  }else{
    obj.photos = [];
  }

  const key = ID_PREFIX + obj.date + "-" + Date.now();
  await set(key, obj);
  saveBtn.disabled = false;
  form.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0,10);
  listReports();
});

clearBtn.addEventListener("click", ()=>{
  if(confirm("Limpar campos do formulário?")) form.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0,10);
});

function renderPhotos(photos){
  if(!photos || photos.length===0) return "";
  return photos.map(p => `<img src="${p.data}" alt="${p.name}" />`).join("");
}

function openModal(data, key){
  modalContent.innerHTML = `
    <h3>${data.project || "Sem projeto"}</h3>
    <div style="color:#666;font-size:14px">${data.date} • ${data.weather || ""}</div>
    <hr/>
    <strong>Progresso</strong>
    <p>${escapeHtml(data.progress || "")}</p>
    <strong>Problemas / Observações</strong>
    <p>${escapeHtml(data.issues || "")}</p>
    <strong>Equipe</strong>
    <p>${escapeHtml(data.crew || "")}</p>
    <strong>Equipamentos</strong>
    <p>${escapeHtml(data.equipment || "")}</p>
    <div>${renderPhotos(data.photos)}</div>
    <pre style="margin-top:10px;color:#333;background:#f7f7f7;padding:8px;border-radius:8px">Criado: ${data.createdAt}</pre>
  `;
  downloadJsonBtn.onclick = ()=> downloadJSON(data, key);
  downloadPdfBtn.onclick = ()=> downloadPDF(data, key);
  modal.classList.remove("hidden");
}

/* generate a simple PDF with text and embedded photos (adds pages as needed) */
function downloadPDF(data, key){
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxImgWidth = pageWidth - margin*2;
  let y = margin;

  doc.setFontSize(16);
  doc.text(data.project || "Sem projeto", margin, y);
  doc.setFontSize(10);
  y += 20;
  doc.text(`Data: ${data.date || ""}    Clima: ${data.weather || ""}`, margin, y);
  y += 18;
  doc.text(`Equipe: ${data.crew || ""}    Equip.: ${data.equipment || ""}`, margin, y);
  y += 20;

  const addWrapped = (title, text)=>{
    if(text){
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 16;
      doc.setFontSize(10);
      const split = doc.splitTextToSize(text, pageWidth - margin*2);
      for(const line of split){
        if(y > pageHeight - margin){
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      y += 8;
    }
  };

  addWrapped("Progresso", data.progress || "");
  addWrapped("Problemas / Observações", data.issues || "");

  // photos
  if(data.photos && data.photos.length>0){
    for(const p of data.photos){
      if(!p || !p.data) continue;
      // estimate image dimensions by creating an image element
      const img = new Image();
      img.src = p.data;
      // synchronous add via onload is not possible here without async; handle via promise
      // collect promises to sequentially place images
      // We'll block further processing until images added by using a chain of promises.
    }
  }

  // function to sequentially add images and then save
  (async ()=>{
    if(data.photos && data.photos.length>0){
      for(const p of data.photos){
        try{
          const img = await loadImage(p.data);
          const ratio = img.width / img.height;
          let drawW = maxImgWidth;
          let drawH = drawW / ratio;
          if(drawH > (pageHeight - y - margin)){
            // not enough space, start new page
            doc.addPage();
            y = margin;
            // recompute available height
            if(drawH > (pageHeight - margin*2)){
              // scale to fit page height
              drawH = pageHeight - margin*2;
              drawW = drawH * ratio;
            }
          }
          if(y + drawH > pageHeight - margin){
            doc.addPage();
            y = margin;
          }
          // canvas draw to ensure JPEG/PNG conversions ok
          const imgData = await imageToDataURL(img, 0.9);
          doc.addImage(imgData, 'JPEG', margin, y, drawW, drawH);
          y += drawH + 10;
        }catch(e){
          console.warn("image add failed", e);
        }
      }
    }

    // metadata footer
    if(y > pageHeight - margin - 30){
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(9);
    doc.text(`Criado: ${data.createdAt || ""}`, margin, pageHeight - margin + 10);
    const filename = (key || "report") + ".pdf";
    doc.save(filename);
  })();
}

// helper to load image
function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=> res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// helper to convert image element to dataURL with canvas (optionally compress)
function imageToDataURL(img, quality=0.92){
  return new Promise((res)=>{
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img,0,0);
    // prefer JPEG for smaller size; if image has transparency it'll be flattened
    res(canvas.toDataURL("image/jpeg", quality));
  });
}

closeModal.addEventListener("click", ()=> modal.classList.add("hidden"));
modal.addEventListener("click", (e)=>{ if(e.target===modal) modal.classList.add("hidden"); });

function escapeHtml(s){
  if(!s) return "";
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function doShare(data){
  const text = buildShareText(data);
  // try Web Share API with images if available
  if(navigator.canShare && data.photos && data.photos.length>0){
    try{
      // convert dataURLs to Blobs
      const files = await Promise.all(data.photos.slice(0,5).map(async p=>{
        const res = await fetch(p.data);
        const blob = await res.blob();
        return new File([blob], p.name || "photo.jpg", {type: blob.type});
      }));
      await navigator.share({title: data.project, text, files});
      return;
    }catch(err){
      // fallback to text share
    }
  }
  if(navigator.share){
    await navigator.share({title: data.project, text});
  }else{
    // fallback: copy to clipboard
    try{
      await navigator.clipboard.writeText(text);
      alert("Texto copiado para a área de transferência.");
    }catch(e){
      // final fallback: open modal with text
      openModal({ ...data, progress: data.progress + "\n\n(Compartilhar manualmente)" });
    }
  }
}

function buildShareText(data){
  return `${data.project || ""}\nData: ${data.date || ""}\nClima: ${data.weather || ""}\nEquipe: ${data.crew || ""}\nEquip.: ${data.equipment || ""}\n\nProgresso:\n${data.progress || ""}\n\nObservações:\n${data.issues || ""}`;
}

function downloadJSON(data, key){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (key || "report") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

exportAllBtn.addEventListener("click", async ()=>{
  const allKeys = await keys();
  const reportKeys = allKeys.filter(k => typeof k === "string" && k.startsWith(ID_PREFIX)).sort();
  const arr = [];
  for(const k of reportKeys){
    arr.push(await get(k));
  }
  const blob = new Blob([JSON.stringify(arr, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorios-obra.json";
  a.click();
  URL.revokeObjectURL(url);
});

shareLatestBtn.addEventListener("click", async ()=>{
  const allKeys = await keys();
  const reportKeys = allKeys.filter(k => typeof k === "string" && k.startsWith(ID_PREFIX)).sort().reverse();
  if(reportKeys.length===0){ alert("Nenhum relatório salvo"); return; }
  const data = await get(reportKeys[0]);
  await doShare(data);
});

// initial load
listReports();

// register basic service worker for offline if available (optional)
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}