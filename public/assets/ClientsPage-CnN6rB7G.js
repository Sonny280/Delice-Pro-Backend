import{a as et,u as tt,r as g,j as e,l as ye,F as Se,S as Le,C as ge,X as rt,A as st,d as A,z as E}from"./index-2iPaa_3W.js";import{a as Ie,b as xe,B as h,K as O,d as Ae,C as De,M as V}from"./index-BCp9gpEI.js";import{A as it,P as Ue,M as ot}from"./phone-CD_fGaX2.js";import{P as Oe}from"./pencil-B_ZOM4q9.js";import{P as J}from"./plus-DOv9_5J4.js";import{C as Fe}from"./clipboard-list-BmrwojkS.js";import{R as qe,U as pe}from"./user-ClsQXO9Y.js";import{F as Me}from"./factory-D7gxoNTu.js";import{T as Ve}from"./trash-2-DdbidaUg.js";import{B as be}from"./building-2-DHenNnLF.js";const F={RECUE:{label:"Reçue",type:"info",next:"EN_PRODUCTION",action:"Lancer en production"},EN_PRODUCTION:{label:"En production",type:"warn",next:"PRETE",action:"Marquer prête"},PRETE:{label:"Prête",type:"ok",next:"LIVREE",action:"Marquer livrée"},LIVREE:{label:"Livrée",type:"neutral",next:null},ANNULEE:{label:"Annulée",type:"err",next:null}};function Be(i,c,r){const p=C=>`${Number(C).toLocaleString("fr-FR")} ${(r==null?void 0:r.devise)??"F"}`,R=new Date(i.dateLivraison).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),j=new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}),P=i.montantTotal-i.acompte,f=(i.lignes??[]).map(C=>{var D;return`
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${((D=C.produit)==null?void 0:D.nom)??"—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${C.quantite}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${p(C.prixUnitaire)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${p(C.sousTotal)}</td>
    </tr>
  `}).join(""),T=`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de commande ${i.reference}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2744; background: white; padding: 40px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; }
    .company-name { font-size: 26px; font-weight: 800; color: ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; letter-spacing: -0.5px; }
    .company-info { font-size: 12px; color: #666; margin-top: 6px; line-height: 1.6; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 22px; font-weight: 700; color: ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; }
    .doc-title .ref { font-size: 13px; color: #888; margin-top: 4px; }
    .doc-title .date { font-size: 12px; color: #888; margin-top: 2px; }
    .section { display: flex; gap: 24px; margin-bottom: 32px; }
    .box { flex: 1; background: #f8f9fc; border-radius: 10px; padding: 16px; }
    .box-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 10px; }
    .box-content { font-size: 14px; color: #1a2744; line-height: 1.7; }
    .box-content strong { font-weight: 700; font-size: 16px; }
    .livraison-date { background: ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}15; border-left: 4px solid ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; }
    thead th { padding: 12px; color: white; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: left; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    tbody tr:hover { background: #f8f9fc; }
    .totaux { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #555; }
    .total-row.grand-total { font-size: 17px; font-weight: 800; color: ${(r==null?void 0:r.couleurPrincipale)??"#1a2744"}; border-bottom: none; padding-top: 12px; }
    .total-row.acompte { color: #16a34a; }
    .total-row.reste { color: ${P>0?"#dc2626":"#16a34a"}; font-weight: 700; }
    .notes-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px; margin-bottom: 32px; font-size: 13px; color: #92400e; }
    .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { text-align: center; }
    .signature-line { width: 200px; border-bottom: 2px solid #ccc; margin-bottom: 8px; height: 60px; }
    .signature-label { font-size: 11px; color: #999; }
    .footer-note { font-size: 11px; color: #aaa; text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; }
    .statut-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background: ${i.statut==="LIVREE"?"#dcfce7":i.statut==="PRETE"?"#d1fae5":i.statut==="EN_PRODUCTION"?"#fef3c7":"#dbeafe"}; color: ${i.statut==="LIVREE"?"#166534":i.statut==="PRETE"?"#065f46":i.statut==="EN_PRODUCTION"?"#92400e":"#1e40af"}; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${(r==null?void 0:r.nom)??"Delice Pro"}</div>
      <div class="company-info">
        ${r!=null&&r.adresse?r.adresse+"<br>":""}
        ${r!=null&&r.telephone?"Tél : "+r.telephone+"<br>":""}
        ${r!=null&&r.email?r.email:""}
      </div>
    </div>
    <div class="doc-title">
      <h2>BON DE COMMANDE</h2>
      <div class="ref">${i.reference} &nbsp; <span class="statut-badge">${F[i.statut].label}</span></div>
      <div class="date">Émis le ${j}</div>
    </div>
  </div>

  <div class="section">
    <div class="box">
      <div class="box-title">Client</div>
      <div class="box-content">
        <strong>${c.nom}</strong><br>
        ${c.entreprise?c.entreprise+"<br>":""}
        ${c.telephone?"📞 "+c.telephone+"<br>":""}
        ${c.email?"✉ "+c.email+"<br>":""}
        ${c.adresse?c.adresse:""}
      </div>
    </div>
    <div class="box livraison-date">
      <div class="box-title">📅 Date de livraison</div>
      <div class="box-content">
        <strong>${R}</strong>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th style="text-align:center;">Quantité</th>
        <th style="text-align:right;">Prix unitaire</th>
        <th style="text-align:right;">Sous-total</th>
      </tr>
    </thead>
    <tbody>
      ${f}
    </tbody>
  </table>

  <div class="totaux">
    <div class="total-row grand-total">
      <span>Total</span>
      <span>${p(i.montantTotal)}</span>
    </div>
    ${i.acompte>0?`
    <div class="total-row acompte">
      <span>Acompte versé</span>
      <span>- ${p(i.acompte)}</span>
    </div>
    <div class="total-row reste">
      <span>Reste à payer</span>
      <span>${P>0?p(P):"Soldé ✓"}</span>
    </div>`:""}
  </div>

  ${i.notes?`<div class="notes-box"><strong>Notes :</strong> ${i.notes}</div>`:""}

  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Signature du client</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Signature ${(r==null?void 0:r.nom)??""}</div>
    </div>
  </div>

  <div class="footer-note">
    Document généré par Delice Pro — ${j}
  </div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`,y=window.open("","_blank");y&&(y.document.write(T),y.document.close())}function _e(i,c,r){const p=(r==null?void 0:r.couleurPrincipale)??"#1a2744",R=new Date(i.dateLivraison).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),j=new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}),P=(i.lignes??[]).map(y=>{var C;return`
    <tr>
      <td style="padding:12px;border-bottom:1px solid #f0f0f0;font-weight:500;">${((C=y.produit)==null?void 0:C.nom)??"—"}</td>
      <td style="padding:12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:18px;font-weight:700;color:${p};">${y.quantite}</td>
      <td style="padding:12px;border-bottom:1px solid #f0f0f0;text-align:center;">
        <div style="width:24px;height:24px;border:2px solid #ccc;border-radius:4px;margin:0 auto;"></div>
      </td>
    </tr>
  `}).join(""),f=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Bon de livraison ${i.reference}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif;color:#1a2744;background:white;padding:40px;font-size:14px; }
    .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${p}; }
    .company-name { font-size:24px;font-weight:800;color:${p}; }
    .company-info { font-size:12px;color:#666;margin-top:6px;line-height:1.6; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px;font-weight:700;color:${p}; }
    .doc-ref { font-size:13px;color:#888;margin-top:4px; }
    .parties { display:flex;gap:20px;margin-bottom:28px; }
    .box { flex:1;background:#f8f9fc;border-radius:10px;padding:16px; }
    .box-title { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:8px; }
    .box-nom { font-size:16px;font-weight:700; }
    .box-info { font-size:12px;color:#666;margin-top:4px;line-height:1.6; }
    table { width:100%;border-collapse:collapse;margin-bottom:24px; }
    thead tr { background:${p}; }
    thead th { padding:11px 12px;color:white;font-size:11px;text-transform:uppercase;font-weight:600;text-align:left; }
    thead th:nth-child(2),thead th:nth-child(3) { text-align:center; }
    .info-livraison { background:${p}15;border-left:4px solid ${p};border-radius:8px;padding:16px;margin-bottom:24px; }
    .info-livraison-date { font-size:16px;font-weight:700;color:${p}; }
    .signatures { display:flex;justify-content:space-between;margin-top:48px; }
    .sig-box { text-align:center; }
    .sig-line { width:200px;border-bottom:2px solid #ccc;height:60px;margin-bottom:8px; }
    .sig-label { font-size:11px;color:#999; }
    .footer-note { text-align:center;font-size:11px;color:#bbb;margin-top:32px;padding-top:16px;border-top:1px solid #eee; }
    @media print { body{padding:20px} @page{margin:12mm} }
  </style></head><body>
  <div class="header">
    <div>
      <div class="company-name">${(r==null?void 0:r.nom)??"Delice Pro"}</div>
      <div class="company-info">
        ${r!=null&&r.adresse?r.adresse+"<br>":""}
        ${r!=null&&r.telephone?"Tél : "+r.telephone+"<br>":""}
        ${(r==null?void 0:r.email)??""}
      </div>
    </div>
    <div class="doc-title">
      <h2>BON DE LIVRAISON</h2>
      <div class="doc-ref">${i.reference}</div>
      <div class="doc-ref" style="margin-top:2px;font-size:11px;color:#aaa;">Émis le ${j}</div>
    </div>
  </div>

  <div class="parties">
    <div class="box">
      <div class="box-title">Livré à</div>
      <div class="box-nom">${c.nom}</div>
      <div class="box-info">
        ${c.entreprise?c.entreprise+"<br>":""}
        ${c.telephone?"Tél : "+c.telephone+"<br>":""}
        ${c.adresse??""}
      </div>
    </div>
    <div class="box" style="background:${p}10;border-left:4px solid ${p}">
      <div class="box-title">📅 Date de livraison</div>
      <div class="info-livraison-date">${R}</div>
      ${i.notes?`<div class="box-info" style="margin-top:8px">Note : ${i.notes}</div>`:""}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Désignation</th>
      <th style="text-align:center">Quantité</th>
      <th style="text-align:center">✓ Reçu</th>
    </tr></thead>
    <tbody>${P}</tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Livré par</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Reçu par ${c.nom}</div>
    </div>
  </div>
  <div class="footer-note">Document généré par Delice Pro — ${j}</div>
  <script>window.onload = () => window.print();<\/script>
</body></html>`,T=window.open("","_blank");T&&(T.document.write(f),T.document.close())}function Ke(i,c,r){const p=S=>`${Number(S).toLocaleString("fr-FR")} ${(r==null?void 0:r.devise)??"F"}`,R=(r==null?void 0:r.couleurPrincipale)??"#1a2744",j=new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}),P=new Date(i.dateLivraison).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}),f=i.montantTotal-i.acompte,T=`FAC-${i.reference}`,y=(i.lignes??[]).map(S=>{var n;return`
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${((n=S.produit)==null?void 0:n.nom)??"—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${S.quantite}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${p(S.prixUnitaire)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${p(S.sousTotal)}</td>
    </tr>
  `}).join(""),C=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Facture ${T}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif;color:#1a2744;background:white;padding:40px;font-size:14px; }
    .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${R}; }
    .company-name { font-size:24px;font-weight:800;color:${R}; }
    .company-info { font-size:12px;color:#666;margin-top:6px;line-height:1.6; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px;font-weight:700;color:${R}; }
    .doc-ref { font-size:13px;color:#888;margin-top:4px; }
    .parties { display:flex;gap:20px;margin-bottom:28px; }
    .box { flex:1;background:#f8f9fc;border-radius:10px;padding:16px; }
    .box-title { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:8px; }
    .box-nom { font-size:16px;font-weight:700; }
    .box-info { font-size:12px;color:#666;margin-top:4px;line-height:1.6; }
    table { width:100%;border-collapse:collapse;margin-bottom:24px; }
    thead tr { background:${R}; }
    thead th { padding:11px 12px;color:white;font-size:11px;text-transform:uppercase;font-weight:600;text-align:left; }
    tbody tr:nth-child(even) { background:#f8f9fc; }
    .totaux { margin-left:auto;width:280px;margin-bottom:32px; }
    .total-row { display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555; }
    .total-final { font-size:17px;font-weight:800;color:${R};border-bottom:none;padding-top:10px; }
    .acompte { color:#16a34a; }
    .reste-row { color:${f>0?"#dc2626":"#16a34a"};font-weight:700; }
    .solde-box { text-align:center;padding:16px;border-radius:10px;margin-bottom:24px;
      background:${f<=0?"#dcfce7":"#fee2e2"};
      border:2px solid ${f<=0?"#16a34a":"#dc2626"}; }
    .solde-label { font-size:12px;font-weight:600;color:${f<=0?"#166534":"#991b1b"}; }
    .solde-montant { font-size:24px;font-weight:800;color:${f<=0?"#166534":"#dc2626"};margin-top:4px; }
    .signatures { display:flex;justify-content:space-between;margin-top:40px; }
    .sig-box { text-align:center; }
    .sig-line { width:200px;border-bottom:2px solid #ccc;height:60px;margin-bottom:8px; }
    .sig-label { font-size:11px;color:#999; }
    .footer-note { text-align:center;font-size:11px;color:#bbb;margin-top:32px;padding-top:16px;border-top:1px solid #eee; }
    .mention { font-size:11px;color:#999;margin-top:24px;line-height:1.7; }
    @media print { body{padding:20px} @page{margin:12mm} }
  </style></head><body>
  <div class="header">
    <div>
      <div class="company-name">${(r==null?void 0:r.nom)??"Delice Pro"}</div>
      <div class="company-info">
        ${r!=null&&r.adresse?r.adresse+"<br>":""}
        ${r!=null&&r.telephone?"Tél : "+r.telephone+"<br>":""}
        ${(r==null?void 0:r.email)??""}
      </div>
    </div>
    <div class="doc-title">
      <h2>FACTURE</h2>
      <div class="doc-ref">N° ${T}</div>
      <div class="doc-ref" style="margin-top:2px;font-size:11px;color:#aaa;">Date : ${j}</div>
    </div>
  </div>

  <div class="parties">
    <div class="box">
      <div class="box-title">Facturé à</div>
      <div class="box-nom">${c.nom}</div>
      <div class="box-info">
        ${c.entreprise?c.entreprise+"<br>":""}
        ${c.telephone?"Tél : "+c.telephone+"<br>":""}
        ${c.email?c.email+"<br>":""}
        ${c.adresse??""}
      </div>
    </div>
    <div class="box">
      <div class="box-title">Détails facture</div>
      <div class="box-info">
        Référence commande : <strong>${i.reference}</strong><br>
        Date livraison : <strong>${P}</strong><br>
        Date facture : <strong>${j}</strong>
      </div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Désignation</th>
      <th style="text-align:center">Qté</th>
      <th style="text-align:right">Prix unitaire</th>
      <th style="text-align:right">Montant</th>
    </tr></thead>
    <tbody>${y}</tbody>
  </table>

  <div class="totaux">
    <div class="total-row total-final"><span>Total</span><span>${p(i.montantTotal)}</span></div>
    ${i.acompte>0?`
    <div class="total-row acompte"><span>Acompte versé</span><span>− ${p(i.acompte)}</span></div>
    <div class="total-row reste-row"><span>Reste à payer</span><span>${p(f)}</span></div>
    `:""}
  </div>

  <div class="solde-box">
    <div class="solde-label">${f<=0?"✅ FACTURE SOLDÉE":"⚠ RESTE À PAYER"}</div>
    <div class="solde-montant">${f<=0?"Payé intégralement":p(f)}</div>
  </div>

  ${i.notes?`<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px;margin-bottom:24px;font-size:13px;color:#92400e;"><strong>Notes :</strong> ${i.notes}</div>`:""}

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Signature ${(r==null?void 0:r.nom)??""}</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Signature client</div>
    </div>
  </div>

  <div class="mention">
    Merci pour votre confiance. Ce document vaut facture et reçu de paiement selon les conditions convenues.
    ${(r==null?void 0:r.nom)??"Delice Pro"} — ${(r==null?void 0:r.adresse)??""} — ${(r==null?void 0:r.telephone)??""}
  </div>
  <div class="footer-note">Document généré par Delice Pro — ${j}</div>
  <script>window.onload = () => window.print();<\/script>
</body></html>`,D=window.open("","_blank");D&&(D.document.write(C),D.document.close())}function Nt(){const{company:i}=et(),c=tt(),r=t=>`${Number(t).toLocaleString("fr-FR")} ${(i==null?void 0:i.devise)??"F"}`,[p,R]=g.useState([]),[j,P]=g.useState([]),[f,T]=g.useState([]),[y,C]=g.useState([]),[D,S]=g.useState(!0),[n,W]=g.useState(null),Qe=j.filter(t=>{var l;return((l=t.client)==null?void 0:l.id)===(n==null?void 0:n.id)}),[Z,N]=g.useState(null),[w,U]=g.useState(null),[me,z]=g.useState(null),[a,ee]=g.useState(null),[q,B]=g.useState(""),[$,_]=g.useState("PARTICULIER"),[te,K]=g.useState(""),[re,Q]=g.useState(""),[se,Y]=g.useState(""),[ie,H]=g.useState(""),[oe,G]=g.useState(""),[at,Ye]=g.useState(!1),[lt,He]=g.useState(""),[nt,Ge]=g.useState(""),[dt,ct]=g.useState(!1),[ae,he]=g.useState(""),[le,ve]=g.useState(0),[fe,je]=g.useState(""),[ne,de]=g.useState([{produitId:"",quantite:1,prixUnitaire:0}]),M=async()=>{var t;S(!0);try{const[l,x,u,s]=await Promise.all([A.get("/clients"),A.get("/commandes-client"),A.get("/produits"),A.get("/recettes")]),d=l.data.success?l.data.data:[],o=x.data.success?x.data.data:[],b=d.map(m=>{const v=o.filter(k=>{var I;return((I=k.client)==null?void 0:I.id)===m.id});return{...m,caTotal:v.reduce((k,I)=>k+I.montantTotal,0),caEncours:v.filter(k=>!["LIVREE","ANNULEE"].includes(k.statut)).reduce((k,I)=>k+(I.montantTotal-I.acompte),0)}});if(R(b),P(o),u.data.success&&T(u.data.data),(t=s.data)!=null&&t.success&&C(s.data.data),n){const m=b.find(v=>v.id===n.id);m&&W(m)}}finally{S(!1)}};g.useEffect(()=>{M()},[]);const Ne=j.filter(t=>["RECUE","EN_PRODUCTION","PRETE"].includes(t.statut)).length,Xe=j.filter(t=>t.statut!=="ANNULEE").reduce((t,l)=>t+l.montantTotal,0),we=j.filter(t=>!["LIVREE","ANNULEE"].includes(t.statut)).reduce((t,l)=>t+(l.montantTotal-l.acompte),0),Ee=j.filter(t=>!["LIVREE","ANNULEE"].includes(t.statut)&&new Date(t.dateLivraison)<new Date).length,L=()=>{B(""),_("PARTICULIER"),K(""),Q(""),Y(""),H(""),G("")},Ce=t=>{U(t),B(t.nom),_(t.type),K(t.telephone??""),Q(t.email??""),Y(t.adresse??""),H(t.entreprise??""),G(t.notes??""),N("edit")},$e=()=>({nom:q,type:$,telephone:te||void 0,email:re||void 0,adresse:se||void 0,entreprise:ie||void 0,notes:oe||void 0}),Je=async()=>{if(!q.trim()){E.error("Le nom est requis");return}try{await A.post("/clients",$e()),E.success(`Client "${q}" créé !`),N(null),L(),M()}catch{}},ke=async()=>{if(w)try{await A.put(`/clients/${w.id}`,$e()),E.success("Client mis à jour !"),N(null),U(null),L(),M()}catch{}},We=async()=>{if(w)try{await A.delete(`/clients/${w.id}`),E.success("Client supprimé"),N(null),U(null),(n==null?void 0:n.id)===w.id&&W(null),M()}catch{}},X=()=>{he(""),ve(0),je(""),de([{produitId:"",quantite:1,prixUnitaire:0}])},ue=(t,l,x)=>{de(u=>u.map((s,d)=>{if(d!==t)return s;const o={...s,[l]:x};if(l==="produitId"){const b=f.find(m=>m.id===x);b&&(o.prixUnitaire=b.prixVente)}return o}))},Re=ne.filter(t=>t.produitId&&t.quantite>0).reduce((t,l)=>t+l.quantite*l.prixUnitaire,0),Ze=async()=>{var l,x;if(!n)return;if(!ae){E.error("Indiquez la date de livraison");return}if(new Date(ae)<new Date(new Date().toDateString())){E.error("La date de livraison ne peut pas être dans le passé");return}const t=ne.filter(u=>u.produitId&&u.quantite>0&&u.prixUnitaire>0);if(!t.length){E.error("Ajoutez au moins un produit");return}try{const u=await A.post("/commandes-client",{clientId:n.id,dateLivraison:ae,acompte:le,notes:fe||void 0,lignes:t});if(u.data.stockOK)E.success("✅ Commande créée — Stock disponible, prête à livrer !");else{const d=(u.data.manquants??[]).map(o=>`${o.nom} : ${o.aProduire} à produire`).join(", ");E(`📦 Commande créée — Production nécessaire : ${d}`,{duration:5e3,icon:"⚠️"})}z(null),X(),M()}catch(u){E.error(((x=(l=u==null?void 0:u.response)==null?void 0:l.data)==null?void 0:x.message)??"Erreur lors de la création")}},ce=async(t,l)=>{var x;try{await A.put(`/commandes-client/${t.id}/statut`,{statut:l}),E.success(`→ ${(x=F[l])==null?void 0:x.label}`),M(),(a==null?void 0:a.id)===t.id&&ee({...t,statut:l})}catch{}},Te=async t=>{var s,d,o,b;await ce(t,"EN_PRODUCTION");const l=new Map,x=[];for(const m of t.lignes??[]){const v=f.find(I=>{var Pe;return I.id===((Pe=m.produit)==null?void 0:Pe.id)});if(!(v!=null&&v.recetteId)){x.push(((s=m.produit)==null?void 0:s.nom)??"?");continue}const k=v.recetteId;l.has(k)||l.set(k,{recetteId:v.recetteId,recetteNom:((d=v.recette)==null?void 0:d.nom)??"Recette inconnue",produits:[]}),l.get(k).produits.push({produitId:v.id,nom:((o=m.produit)==null?void 0:o.nom)??"—",quantite:m.quantite,grammage:v.grammage})}const u=Array.from(l.values());c("/production",{state:{fromCommande:!0,commandeId:t.id,referenceCommande:t.reference,nomClient:((b=t.client)==null?void 0:b.nom)??"—",recettesGroupees:u,sansProduit:x}}),x.length>0&&E(`⚠ ${x.join(", ")} n'ont pas de recette liée`,{duration:5e3}),E.success(`Production lancée — ${u.length} recette(s) à fabriquer`)},ze=t=>{var l,x;c("/ventes",{state:{fromCommande:!0,commandeId:t.id,referenceCommande:t.reference,nomClient:((l=t.client)==null?void 0:l.nom)??"—",clientId:(x=t.client)==null?void 0:x.id,acompte:t.acompte??0,montantTotal:t.montantTotal,lignes:(t.lignes??[]).map(u=>{var s,d;return{produitId:((s=u.produit)==null?void 0:s.id)??"",nom:((d=u.produit)==null?void 0:d.nom)??"—",quantite:u.quantite,prixUnitaire:u.prixUnitaire}})}}),E.success("Caisse pré-remplie avec la commande !")};if(n){const t=Qe,l=t.filter(s=>s.statut!=="ANNULEE").reduce((s,d)=>s+d.montantTotal,0),x=t.filter(s=>!["LIVREE","ANNULEE"].includes(s.statut)).reduce((s,d)=>s+(d.montantTotal-d.acompte),0),u=t.filter(s=>["RECUE","EN_PRODUCTION","PRETE"].includes(s.statut)).length;return e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-3 mb-6",children:[e.jsx("button",{onClick:()=>W(null),className:"p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg)]",children:e.jsx(it,{size:16})}),e.jsxs("div",{className:"flex-1",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Ie,{children:n.nom}),e.jsx(xe,{type:n.type==="PROFESSIONNEL"?"info":"neutral",children:n.type==="PROFESSIONNEL"?"Pro":"Particulier"})]}),n.entreprise&&e.jsx("div",{className:"text-sm text-[var(--color-text-2)] mt-0.5",children:n.entreprise})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(h,{variant:"outline",size:"sm",icon:e.jsx(Oe,{size:13}),onClick:()=>Ce(n),children:"Modifier"}),e.jsx(h,{size:"sm",icon:e.jsx(J,{size:13}),onClick:()=>{X(),z("create")},children:"Nouvelle commande"})]})]}),e.jsxs("div",{className:"flex gap-4 mb-5 flex-wrap",children:[n.telephone&&e.jsxs("a",{href:`tel:${n.telephone}`,className:"flex items-center gap-1.5 text-sm text-[var(--color-text-2)] hover:text-[var(--color-primary)]",children:[e.jsx(Ue,{size:13}),n.telephone]}),n.email&&e.jsxs("a",{href:`mailto:${n.email}`,className:"flex items-center gap-1.5 text-sm text-[var(--color-text-2)] hover:text-[var(--color-primary)]",children:[e.jsx(ot,{size:13}),n.email]}),n.adresse&&e.jsx("span",{className:"text-sm text-[var(--color-text-2)]",children:n.adresse})]}),e.jsxs("div",{className:"grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5",children:[e.jsx(O,{label:"Total commandes",value:t.length}),e.jsx(O,{label:"En cours",value:u,deltaType:u>0?"warn":"neutral"}),e.jsx(O,{label:"CA total",value:r(l)}),e.jsx(O,{label:"À encaisser",value:r(x),deltaType:x>0?"warn":"neutral"})]}),n.notes&&e.jsx(Ae,{type:"info",children:n.notes}),e.jsx(De,{title:"Commandes",className:"mt-4",children:t.length===0?e.jsxs("div",{className:"flex flex-col items-center py-12 gap-3 text-[var(--color-text-3)]",children:[e.jsx(Fe,{size:36,opacity:.3}),e.jsx("p",{children:"Aucune commande."}),e.jsx(h,{size:"sm",icon:e.jsx(J,{size:13}),onClick:()=>{X(),z("create")},children:"Créer une commande"})]}):e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b border-[var(--color-border)]",children:["Réf.","Livraison","Produits","Montant","Acompte","Reste","Statut","Actions"].map(s=>e.jsx("th",{className:"text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-3)]",children:s},s))})}),e.jsx("tbody",{children:t.sort((s,d)=>new Date(d.dateLivraison).getTime()-new Date(s.dateLivraison).getTime()).map(s=>{const d=F[s.statut],o=!["LIVREE","ANNULEE"].includes(s.statut)&&new Date(s.dateLivraison)<new Date,b=s.montantTotal-s.acompte;return e.jsxs("tr",{className:`border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] ${o?"bg-red-50/40":""}`,children:[e.jsxs("td",{className:"px-3 py-3",children:[e.jsx("div",{className:"font-mono text-xs font-bold text-[var(--color-primary)]",children:s.reference}),o&&e.jsx("div",{className:"text-[10px] text-red-500 font-medium",children:"⚠ En retard"})]}),e.jsx("td",{className:"px-3 py-3 whitespace-nowrap text-[var(--color-text-2)]",children:new Date(s.dateLivraison).toLocaleDateString("fr-FR")}),e.jsx("td",{className:"px-3 py-3 text-[var(--color-text-2)] max-w-[160px] truncate",children:(s.lignes??[]).map(m=>{var v;return`${m.quantite}× ${((v=m.produit)==null?void 0:v.nom)??"—"}`}).join(", ")}),e.jsx("td",{className:"px-3 py-3 font-semibold",children:r(s.montantTotal)}),e.jsx("td",{className:"px-3 py-3 text-[var(--color-ok)]",children:s.acompte>0?r(s.acompte):"—"}),e.jsx("td",{className:"px-3 py-3 font-medium",style:{color:b>0?"var(--color-err)":"var(--color-ok)"},children:b>0?r(b):"Soldé"}),e.jsx("td",{className:"px-3 py-3",children:e.jsx(xe,{type:d.type,children:d.label})}),e.jsx("td",{className:"px-3 py-3",children:e.jsxs("div",{className:"flex gap-1",children:[e.jsx("button",{onClick:()=>{ee(s),z("detail")},className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)]",title:"Voir le détail",children:e.jsx(Fe,{size:12})}),e.jsx("button",{onClick:()=>Be(s,n,i),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-blue-50 hover:border-blue-300",title:"Bon de commande",children:e.jsx(ye,{size:12,className:"text-blue-500"})}),["PRETE","LIVREE"].includes(s.statut)&&e.jsx("button",{onClick:()=>_e(s,n,i),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-purple-50 hover:border-purple-300",title:"Bon de livraison",children:e.jsx(Se,{size:12,className:"text-purple-500"})}),["PRETE","LIVREE"].includes(s.statut)&&e.jsx("button",{onClick:()=>Ke(s,n,i),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-orange-50 hover:border-orange-300",title:"Imprimer la facture",children:e.jsx(qe,{size:12,className:"text-orange-500"})}),s.statut==="RECUE"&&e.jsx("button",{onClick:()=>Te(s),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-orange-50 hover:border-orange-300",title:"Lancer en production",children:e.jsx(Me,{size:12,className:"text-orange-500"})}),s.statut==="PRETE"&&e.jsx("button",{onClick:()=>ze(s),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-green-50 hover:border-green-300",title:"Créer la vente en caisse",children:e.jsx(Le,{size:12,className:"text-green-600"})}),d.next&&e.jsx("button",{onClick:()=>ce(s,d.next),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-green-50 hover:border-green-300",title:d.action,children:e.jsx(ge,{size:12,className:"text-[var(--color-ok)]"})}),!["LIVREE","ANNULEE"].includes(s.statut)&&e.jsx("button",{onClick:()=>ce(s,"ANNULEE"),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-red-50 hover:border-red-300",title:"Annuler",children:e.jsx(rt,{size:12,className:"text-[var(--color-err)]"})})]})})]},s.id)})})]})})}),e.jsx(V,{open:me==="create",onClose:()=>{z(null),X()},title:`Nouvelle commande — ${n.nom}`,size:"lg",footer:e.jsxs(e.Fragment,{children:[e.jsx(h,{variant:"outline",onClick:()=>{z(null),X()},children:"Annuler"}),e.jsx(h,{onClick:Ze,children:"Créer la commande"})]}),children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Date de livraison *"}),e.jsx("input",{className:"input",type:"date",value:ae,onChange:s=>he(s.target.value)})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:["Acompte (",(i==null?void 0:i.devise)??"F",")"]}),e.jsx("input",{className:"input",type:"number",min:"0",value:le,onChange:s=>ve(Number(s.target.value))})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-2",children:"Produits commandés *"}),e.jsxs("div",{className:"mb-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700",children:["💡 Les produits marqués ",e.jsx("strong",{children:'"à produire"'})," ne sont pas encore en stock — ils seront fabriqués avant la livraison."]}),e.jsx("div",{className:"space-y-2",children:ne.map((s,d)=>e.jsxs("div",{className:"space-y-1",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("select",{className:"input flex-1 text-sm",value:s.produitId,onChange:o=>ue(d,"produitId",o.target.value),children:[e.jsx("option",{value:"",children:"Choisir un produit..."}),f.map(o=>e.jsxs("option",{value:o.id,children:[o.nom," — ",r(o.prixVente)," (stock: ",o.stockActuel??0,")"]},o.id))]}),e.jsx("input",{className:"input w-20 text-center text-sm",type:"number",min:"1",placeholder:"Qté",value:s.quantite||"",onChange:o=>ue(d,"quantite",parseInt(o.target.value)||0)}),e.jsx("input",{className:"input w-28 text-sm",type:"number",placeholder:"Prix",value:s.prixUnitaire||"",onChange:o=>ue(d,"prixUnitaire",Number(o.target.value))}),e.jsx("button",{onClick:()=>de(o=>o.filter((b,m)=>m!==d)),disabled:ne.length===1,className:"p-2 rounded-lg border border-[var(--color-border)] hover:bg-red-50",children:e.jsx(Ve,{size:12,className:"text-[var(--color-err)]"})})]}),s.produitId&&s.quantite>0&&(()=>{const o=f.find(k=>k.id===s.produitId),b=(o==null?void 0:o.stockActuel)??0,m=b>=s.quantite,v=b>0&&b<s.quantite;return e.jsx("div",{className:`text-[10px] px-2 py-1 rounded-lg ${m?"bg-green-50 text-green-700":v?"bg-orange-50 text-orange-700":"bg-red-50 text-red-700"}`,children:m?`✅ Stock OK (${b} dispo) — livraison directe`:v?`⚠️ Partiel : ${b}/${s.quantite} — manque ${s.quantite-b} → production`:"🔴 Rupture — production nécessaire"})})()]},d))}),e.jsxs("div",{className:"mt-2 flex gap-2",children:[e.jsxs("button",{onClick:()=>de(s=>[...s,{produitId:"",quantite:1,prixUnitaire:0}]),className:"flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed border-[var(--color-border-2)] justify-center text-[var(--color-text-2)]",children:[e.jsx(J,{size:12})," Ajouter une ligne"]}),e.jsxs("button",{onClick:()=>{He(""),Ge(""),Ye(!0)},className:"flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-dashed border-[var(--color-primary)] justify-center text-[var(--color-primary)] font-medium hover:bg-[var(--color-bg-2)]",children:[e.jsx(J,{size:12})," Nouveau produit"]})]})]}),e.jsxs("div",{className:"flex justify-between items-center p-3 bg-[var(--color-bg-2)] rounded-xl border border-[var(--color-border)]",children:[e.jsxs("div",{className:"text-sm",children:[e.jsx("span",{className:"text-[var(--color-text-2)]",children:"Total : "}),e.jsx("span",{className:"font-bold text-[var(--color-primary)]",children:r(Re)})]}),le>0&&e.jsxs("div",{className:"text-sm",children:[e.jsx("span",{className:"text-[var(--color-text-2)]",children:"Reste : "}),e.jsx("span",{className:"font-bold text-[var(--color-err)]",children:r(Re-le)})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Notes"}),e.jsx("input",{className:"input",value:fe,onChange:s=>je(s.target.value),placeholder:"Occasion, allergies..."})]})]})}),e.jsx(V,{open:me==="detail",onClose:()=>{z(null),ee(null)},title:`Commande ${(a==null?void 0:a.reference)??""}`,size:"lg",footer:e.jsxs("div",{className:"flex justify-between w-full",children:[e.jsx(h,{variant:"outline",onClick:()=>{z(null),ee(null)},children:"Fermer"}),e.jsxs("div",{className:"flex gap-2",children:[a&&e.jsx(h,{variant:"outline",icon:e.jsx(ye,{size:14}),onClick:()=>Be(a,n,i),children:"Bon de commande"}),a&&["PRETE","LIVREE"].includes(a.statut)&&e.jsx(h,{variant:"outline",icon:e.jsx(Se,{size:14}),onClick:()=>_e(a,n,i),children:"Bon de livraison"}),a&&["PRETE","LIVREE"].includes(a.statut)&&e.jsx(h,{variant:"outline",icon:e.jsx(qe,{size:14}),onClick:()=>Ke(a,n,i),children:"Facture"}),(a==null?void 0:a.statut)==="RECUE"&&e.jsx(h,{icon:e.jsx(Me,{size:14}),onClick:()=>{z(null),Te(a)},children:"Lancer en production"}),(a==null?void 0:a.statut)==="PRETE"&&e.jsx(h,{icon:e.jsx(Le,{size:14}),onClick:()=>{z(null),ze(a)},children:"Créer la vente"}),a&&F[a.statut].next&&a.statut!=="RECUE"&&e.jsx(h,{icon:e.jsx(ge,{size:14}),onClick:()=>ce(a,F[a.statut].next),children:F[a.statut].action})]})]}),children:a&&(()=>{const s=F[a.statut],d=a.montantTotal-a.acompte;return e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(xe,{type:s.type,children:s.label}),e.jsxs("div",{className:"text-sm text-[var(--color-text-2)]",children:["Livraison : ",e.jsx("strong",{children:new Date(a.dateLivraison).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})})]})]}),e.jsxs("div",{className:"space-y-1",children:[(a.lignes??[]).map(o=>{var b;return e.jsxs("div",{className:"flex justify-between py-2 border-b border-[var(--color-border)] last:border-0 text-sm",children:[e.jsxs("span",{children:[((b=o.produit)==null?void 0:b.nom)??"—"," ",e.jsxs("span",{className:"text-[var(--color-text-3)]",children:["× ",o.quantite]})]}),e.jsx("span",{className:"font-medium",children:r(o.sousTotal)})]},o.id)}),e.jsxs("div",{className:"flex justify-between pt-2 font-bold",children:[e.jsx("span",{children:"Total"}),e.jsx("span",{children:r(a.montantTotal)})]}),a.acompte>0&&e.jsxs("div",{className:"flex justify-between text-sm text-[var(--color-ok)]",children:[e.jsx("span",{children:"Acompte"}),e.jsxs("span",{children:["- ",r(a.acompte)]})]}),e.jsxs("div",{className:`flex justify-between text-sm font-bold ${d>0?"text-[var(--color-err)]":"text-[var(--color-ok)]"}`,children:[e.jsx("span",{children:"Reste à payer"}),e.jsx("span",{children:d>0?r(d):"Soldé ✓"})]})]}),a.notes&&e.jsxs("div",{className:"p-3 bg-[var(--color-bg-2)] rounded-lg text-sm text-[var(--color-text-2)]",children:[e.jsx("span",{className:"font-medium",children:"Notes : "}),a.notes]}),e.jsx("div",{className:"flex items-center gap-1 flex-wrap",children:["RECUE","EN_PRODUCTION","PRETE","LIVREE"].map((o,b,m)=>e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("div",{className:`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${a.statut===o?"border-[var(--color-primary)] bg-[var(--color-bg-2)] text-[var(--color-primary)]":"border-[var(--color-border)] text-[var(--color-text-3)]"}`,children:F[o].label}),b<m.length-1&&e.jsx(ge,{size:12,className:"text-[var(--color-text-3)]"})]},o))})]})})()}),e.jsx(V,{open:Z==="edit",onClose:()=>{N(null),L()},title:`Modifier — ${w==null?void 0:w.nom}`,footer:e.jsxs(e.Fragment,{children:[e.jsx(h,{variant:"outline",onClick:()=>{N(null),L()},children:"Annuler"}),e.jsx(h,{onClick:ke,children:"Enregistrer"})]}),children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-2",children:"Type"}),e.jsx("div",{className:"flex gap-3",children:[["PARTICULIER","Particulier",pe],["PROFESSIONNEL","Professionnel",be]].map(([s,d,o])=>e.jsxs("button",{type:"button",onClick:()=>_(s),className:`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${$===s?"border-[var(--color-primary)] bg-[var(--color-bg-2)]":"border-[var(--color-border)]"}`,children:[e.jsx(o,{size:15,style:{color:$===s?"var(--color-primary)":"var(--color-text-3)"}}),e.jsx("span",{className:`text-sm font-medium ${$===s?"text-[var(--color-primary)]":"text-[var(--color-text-2)]"}`,children:d})]},s))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Nom *"}),e.jsx("input",{className:"input",value:q,onChange:s=>B(s.target.value),placeholder:"Nom complet"})]}),$==="PROFESSIONNEL"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Entreprise"}),e.jsx("input",{className:"input",value:ie,onChange:s=>H(s.target.value)})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Téléphone"}),e.jsx("input",{className:"input",type:"tel",value:te,onChange:s=>K(s.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Email"}),e.jsx("input",{className:"input",type:"email",value:re,onChange:s=>Q(s.target.value)})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Adresse"}),e.jsx("input",{className:"input",value:se,onChange:s=>Y(s.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Notes"}),e.jsx("input",{className:"input",value:oe,onChange:s=>G(s.target.value),placeholder:"Allergies, préférences..."})]})]})})]})}return e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center justify-between mb-6 flex-wrap gap-3",children:[e.jsx(Ie,{children:"Clients"}),e.jsx(h,{size:"sm",icon:e.jsx(J,{size:14}),onClick:()=>{L(),N("create")},children:"Nouveau client"})]}),e.jsxs("div",{className:"grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5",children:[e.jsx(O,{label:"Total clients",value:p.length}),e.jsx(O,{label:"Commandes en cours",value:Ne,deltaType:Ne>0?"warn":"neutral"}),e.jsx(O,{label:"CA total",value:r(Xe)}),e.jsx(O,{label:"À encaisser",value:r(we),deltaType:we>0?"warn":"neutral"})]}),Ee>0&&e.jsxs("div",{className:"mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm text-red-700",children:[e.jsx(st,{size:16,className:"flex-shrink-0 text-red-500"}),e.jsxs("span",{children:[e.jsxs("strong",{children:[Ee," commande(s) en retard"]})," — date de livraison dépassée !"]})]}),e.jsx(De,{title:"Liste des clients",children:D?e.jsx("div",{className:"flex justify-center py-12",children:e.jsx("div",{className:"w-6 h-6 rounded-full border-4 border-t-transparent animate-spin",style:{borderColor:"var(--color-primary)"}})}):p.length===0?e.jsxs("div",{className:"flex flex-col items-center py-16 gap-3 text-[var(--color-text-3)]",children:[e.jsx(pe,{size:40,opacity:.3}),e.jsx("p",{children:"Aucun client."})]}):e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b border-[var(--color-border)]",children:["Client","Type","Contact","Commandes","CA total","À encaisser","Actions"].map(t=>e.jsx("th",{className:"text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-3)]",children:t},t))})}),e.jsx("tbody",{children:p.map(t=>{var l;return e.jsxs("tr",{className:"border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] cursor-pointer",onClick:()=>W(t),children:[e.jsxs("td",{className:"px-3 py-3",children:[e.jsx("div",{className:"font-semibold text-[var(--color-primary)]",children:t.nom}),t.entreprise&&e.jsx("div",{className:"text-xs text-[var(--color-text-3)]",children:t.entreprise})]}),e.jsx("td",{className:"px-3 py-3",children:e.jsx(xe,{type:t.type==="PROFESSIONNEL"?"info":"neutral",children:t.type==="PROFESSIONNEL"?"Pro":"Particulier"})}),e.jsx("td",{className:"px-3 py-3",children:t.telephone?e.jsxs("div",{className:"flex items-center gap-1 text-[var(--color-text-2)]",children:[e.jsx(Ue,{size:11}),t.telephone]}):"—"}),e.jsx("td",{className:"px-3 py-3 text-center font-bold text-[var(--color-primary)]",children:((l=t._count)==null?void 0:l.commandes)??0}),e.jsx("td",{className:"px-3 py-3 font-medium",children:r(t.caTotal??0)}),e.jsx("td",{className:"px-3 py-3",children:(t.caEncours??0)>0?e.jsx("span",{className:"font-medium text-[var(--color-warn)]",children:r(t.caEncours??0)}):"—"}),e.jsx("td",{className:"px-3 py-3",onClick:x=>x.stopPropagation(),children:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{onClick:()=>Ce(t),className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)]",children:e.jsx(Oe,{size:13})}),e.jsx("button",{onClick:()=>{U(t),N("delete")},className:"p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-red-50 hover:border-red-300",children:e.jsx(Ve,{size:13,className:"text-[var(--color-err)]"})})]})})]},t.id)})})]})})}),e.jsx(V,{open:Z==="create",onClose:()=>{N(null),L()},title:"Nouveau client",footer:e.jsxs(e.Fragment,{children:[e.jsx(h,{variant:"outline",onClick:()=>{N(null),L()},children:"Annuler"}),e.jsx(h,{onClick:Je,children:"Créer"})]}),children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-2",children:"Type"}),e.jsx("div",{className:"flex gap-3",children:[["PARTICULIER","Particulier",pe],["PROFESSIONNEL","Professionnel",be]].map(([t,l,x])=>e.jsxs("button",{type:"button",onClick:()=>_(t),className:`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${$===t?"border-[var(--color-primary)] bg-[var(--color-bg-2)]":"border-[var(--color-border)]"}`,children:[e.jsx(x,{size:15,style:{color:$===t?"var(--color-primary)":"var(--color-text-3)"}}),e.jsx("span",{className:`text-sm font-medium ${$===t?"text-[var(--color-primary)]":"text-[var(--color-text-2)]"}`,children:l})]},t))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Nom *"}),e.jsx("input",{className:"input",value:q,onChange:t=>B(t.target.value),placeholder:"Nom complet"})]}),$==="PROFESSIONNEL"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Entreprise"}),e.jsx("input",{className:"input",value:ie,onChange:t=>H(t.target.value)})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Téléphone"}),e.jsx("input",{className:"input",type:"tel",value:te,onChange:t=>K(t.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Email"}),e.jsx("input",{className:"input",type:"email",value:re,onChange:t=>Q(t.target.value)})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Adresse"}),e.jsx("input",{className:"input",value:se,onChange:t=>Y(t.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Notes"}),e.jsx("input",{className:"input",value:oe,onChange:t=>G(t.target.value),placeholder:"Allergies, préférences..."})]})]})}),e.jsx(V,{open:Z==="edit",onClose:()=>{N(null),U(null),L()},title:`Modifier — ${w==null?void 0:w.nom}`,footer:e.jsxs(e.Fragment,{children:[e.jsx(h,{variant:"outline",onClick:()=>{N(null),U(null),L()},children:"Annuler"}),e.jsx(h,{onClick:ke,children:"Enregistrer"})]}),children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-2",children:"Type"}),e.jsx("div",{className:"flex gap-3",children:[["PARTICULIER","Particulier",pe],["PROFESSIONNEL","Professionnel",be]].map(([t,l,x])=>e.jsxs("button",{type:"button",onClick:()=>_(t),className:`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${$===t?"border-[var(--color-primary)] bg-[var(--color-bg-2)]":"border-[var(--color-border)]"}`,children:[e.jsx(x,{size:15,style:{color:$===t?"var(--color-primary)":"var(--color-text-3)"}}),e.jsx("span",{className:`text-sm font-medium ${$===t?"text-[var(--color-primary)]":"text-[var(--color-text-2)]"}`,children:l})]},t))})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Nom *"}),e.jsx("input",{className:"input",value:q,onChange:t=>B(t.target.value),placeholder:"Nom complet"})]}),$==="PROFESSIONNEL"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Entreprise"}),e.jsx("input",{className:"input",value:ie,onChange:t=>H(t.target.value)})]})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Téléphone"}),e.jsx("input",{className:"input",type:"tel",value:te,onChange:t=>K(t.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Email"}),e.jsx("input",{className:"input",type:"email",value:re,onChange:t=>Q(t.target.value)})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Adresse"}),e.jsx("input",{className:"input",value:se,onChange:t=>Y(t.target.value)})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] block mb-1",children:"Notes"}),e.jsx("input",{className:"input",value:oe,onChange:t=>G(t.target.value),placeholder:"Allergies, préférences..."})]})]})}),e.jsx(V,{open:Z==="delete",onClose:()=>{N(null),U(null)},title:"Supprimer",size:"sm",footer:e.jsxs(e.Fragment,{children:[e.jsx(h,{variant:"outline",onClick:()=>{N(null),U(null)},children:"Annuler"}),e.jsx(h,{variant:"danger",onClick:We,children:"Supprimer"})]}),children:e.jsxs(Ae,{type:"warn",children:["Supprimer ",e.jsx("strong",{children:w==null?void 0:w.nom})," ? Ses commandes seront conservées."]})})]})}export{Nt as default};
