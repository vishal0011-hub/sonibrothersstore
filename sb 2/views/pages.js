// Informational + legal pages (Razorpay website-verification requires: About, Contact, Terms, Privacy, Shipping, Refund, Cancellation)
const { esc } = require('../lib');
const { ICON, waLink } = require('./layout');

const doc = (title, updated, html) => `<section class="wrap narrow page-head"><p class="eyebrow">Policies</p><h1 class="display">${esc(title)}</h1><p class="muted small">Last updated: ${esc(updated)}</p></section><section class="wrap narrow prose">${html}</section>`;
const UPDATED = '19 October 2026';

function biz(s) { return `<b>${esc(s.legal_name)}</b>, ${esc(s.address)}, ${esc(s.city)}, ${esc(s.state)} – ${esc(s.pincode)}${s.gstin ? ` (GSTIN ${esc(s.gstin)})` : ''}`; }

const pages = {
  about: s => `<section class="about-hero"><div class="wrap"><p class="eyebrow">About us</p><h1 class="display xl">Made in our factory.<br><span class="hl">Worn on every street.</span></h1></div></section>
  <section class="wrap narrow prose">
    <p class="lead">${esc(s.brand_name)} is one of Asia's largest garment manufacturers, and we sell our streetwear directly to retailers, resellers and boutiques across India — no distributors, no middlemen.</p>
    <p>Everything you see on this site — heavyweight oversized tees, resort shirts, cargos, baggy denim and fleece — is cut, stitched and finished in our own units. That's how we keep wholesale prices low while holding a consistent quality bar on fabric, GSM, stitching and colour fastness.</p>
    <p>We've delivered to <b>${esc(s.pincodes_delivered)}</b> of India's <b>${esc(s.pincodes_total)}</b> pin codes and are growing every week. Our community of <b>${esc(s.instagram_followers)}</b> on Instagram sees every drop first.</p>
    <h2>Why resellers choose us</h2>
    <ul><li><b>Low MOQ:</b> just ${esc(s.moq)} pieces — mix any designs, colours and sizes.</li><li><b>Flexible payment:</b> prepaid, or COD with only ${esc(s.cod_advance_pct)}% advance.</li><li><b>Trend-first:</b> Gen Z streetwear with new drops every month.</li><li><b>GST invoices</b> on every order, so you can claim input credit.</li></ul>
  </section>`,

  wholesale: s => `<section class="wrap narrow page-head"><p class="eyebrow">Wholesale</p><h1 class="display">How wholesale works</h1></section>
  <section class="wrap narrow prose">
    <ol><li><b>Browse without login.</b> All prices shown are wholesale per-piece prices, inclusive of GST.</li>
    <li><b>Build your bag.</b> The minimum order is <b>${esc(s.moq)} pieces in total</b> — you can mix any products, designs, colours and sizes to reach it.</li>
    <li><b>Log in with OTP</b> at checkout using your mobile number.</li>
    <li><b>Choose payment:</b> Prepaid (100% online) or Cash on Delivery (${esc(s.cod_advance_pct)}% advance online, balance to the courier).</li>
    <li><b>We dispatch in 24–48 hours</b> and share tracking by SMS/WhatsApp.</li></ol>
    <p>Ordering large volumes or need custom branding/private label? <a href="${waLink(s, 'Hi, I want a bulk / private label quote.')}" target="_blank" rel="noopener">Message us on WhatsApp</a>.</p>
  </section>`,

  contact: s => `<section class="wrap page-head"><p class="eyebrow">Contact</p><h1 class="display">We're here to help.</h1><p class="muted">Monday–Saturday, 10 am – 7 pm IST. Fastest on WhatsApp.</p></section>
  <section class="wrap contact-grid">
    <div class="contact-cards">
      <a class="ccard" href="${waLink(s, 'Hi Sony Brothers!')}" target="_blank" rel="noopener">${ICON.wa}<b>WhatsApp</b><span>Chat with our team</span></a>
      <a class="ccard" href="tel:${esc(s.phone.replace(/\s/g, ''))}">${ICON.user}<b>Call</b><span>${esc(s.phone)}</span></a>
      <a class="ccard" href="mailto:${esc(s.email)}">${ICON.bag}<b>Email</b><span>${esc(s.email)}</span></a>
      <div class="ccard">${ICON.pin}<b>Registered office</b><span>${esc(s.legal_name)}<br>${esc(s.address)}, ${esc(s.city)}, ${esc(s.state)} – ${esc(s.pincode)}</span></div>
    </div>
    <form class="stack contact-form" id="contact-form">
      <h2 class="display sm">Send a message</h2>
      <label class="field"><span>Name</span><input name="name" required></label>
      <label class="field"><span>Mobile</span><input name="phone" inputmode="numeric" maxlength="10" required></label>
      <label class="field"><span>Message</span><textarea name="message" rows="5" required></textarea></label>
      <button class="btn">Send</button>
    </form>
  </section>
  <section class="wrap"><iframe class="map" title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(`${s.address}, ${s.city}, ${s.state} ${s.pincode}`)}&output=embed"></iframe></section>`,

  faq: s => {
    const qa = [
      ['What is the minimum order quantity?', `${s.moq} pieces per order in total. You can mix any products, designs, colours and sizes to reach it.`],
      ['Are prices inclusive of GST?', 'Yes. All prices are per piece and include GST. Every order gets a downloadable GST tax invoice. Add your GSTIN at checkout to claim input credit.'],
      ['How does Cash on Delivery work?', `Pay ${s.cod_advance_pct}% of the order value online as an advance when you order. The remaining ${100 - +s.cod_advance_pct}% is paid in cash/UPI to the courier at delivery.`],
      ['Which payment methods do you accept?', 'UPI, debit/credit cards, net banking and wallets via Razorpay, plus COD with advance.'],
      ['Do you deliver to my area?', `We ship pan-India and have already delivered to ${s.pincodes_delivered}+ pin codes. Use the pin code checker on any product page.`],
      ['How long does delivery take?', 'Orders are dispatched in 24–48 hours. Metro cities typically receive in 3–5 working days, other areas in 5–8 working days.'],
      ['Can I return or exchange?', `Manufacturing defects, damaged or wrong items are replaced within ${s.return_days} days of delivery. An unboxing video is required. See our Return Policy.`],
      ['Do I need an account?', 'You can browse without logging in. At checkout, simply log in with your mobile number and OTP.'],
      ['Can I cancel my order?', 'Yes, before it is dispatched. See our Cancellation Policy.'],
      ['Do you do custom branding / private label?', 'Yes, for bulk quantities. Message us on WhatsApp for a quote.'],
    ];
    return `<section class="wrap narrow page-head"><p class="eyebrow">Help</p><h1 class="display">Frequently asked</h1></section>
    <section class="wrap narrow acc faq">${qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }).replace(/</g, '\\u003c')}</script>`;
  },

  'size-guide': s => `<section class="wrap narrow page-head"><p class="eyebrow">Fit</p><h1 class="display">Size guide</h1><p class="muted">Garment measurements in inches. Oversized styles are cut 3–4" roomier than regular — the chart below already accounts for this.</p></section>
  <section class="wrap narrow prose">
    <h2>Tops — Regular fit</h2>
    <div class="tbl"><table><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Shoulder</th></tr></thead><tbody>
    <tr><td>S</td><td>38</td><td>27</td><td>17</td></tr><tr><td>M</td><td>40</td><td>28</td><td>17.5</td></tr><tr><td>L</td><td>42</td><td>29</td><td>18</td></tr><tr><td>XL</td><td>44</td><td>30</td><td>18.5</td></tr><tr><td>XXL</td><td>46</td><td>31</td><td>19</td></tr></tbody></table></div>
    <h2>Tops — Oversized fit</h2>
    <div class="tbl"><table><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Shoulder</th></tr></thead><tbody>
    <tr><td>S</td><td>42</td><td>28</td><td>21</td></tr><tr><td>M</td><td>44</td><td>29</td><td>22</td></tr><tr><td>L</td><td>46</td><td>30</td><td>23</td></tr><tr><td>XL</td><td>48</td><td>31</td><td>24</td></tr><tr><td>XXL</td><td>50</td><td>32</td><td>25</td></tr></tbody></table></div>
    <h2>Bottoms</h2>
    <div class="tbl"><table><thead><tr><th>Size</th><th>Waist</th><th>Hip</th><th>Length</th></tr></thead><tbody>
    <tr><td>28</td><td>28–29</td><td>38</td><td>40</td></tr><tr><td>30</td><td>30–31</td><td>40</td><td>40.5</td></tr><tr><td>32</td><td>32–33</td><td>42</td><td>41</td></tr><tr><td>34</td><td>34–35</td><td>44</td><td>41.5</td></tr><tr><td>36</td><td>36–37</td><td>46</td><td>42</td></tr></tbody></table></div>
    <p class="small muted">Measurements may vary by ±0.5". Edit this chart to match your exact patterns.</p>
  </section>`,

  terms: s => doc('Terms & Conditions', UPDATED, `
    <p>This website is operated by ${biz(s)} ("${esc(s.brand_name)}", "we", "us"). By accessing the site or placing an order, you agree to these terms.</p>
    <h2>1. Wholesale sales</h2><p>We sell garments on a wholesale basis to retailers, resellers and individual buyers. A minimum order quantity (MOQ) of ${esc(s.moq)} pieces per order applies; pieces may be mixed across products, designs, colours and sizes.</p>
    <h2>2. Account and OTP login</h2><p>Browsing does not require an account. To place an order you must verify your mobile number by one-time password (OTP). You are responsible for the accuracy of the details you provide and for activity on your account.</p>
    <h2>3. Prices and taxes</h2><p>All prices are in Indian Rupees, per piece, and inclusive of applicable GST unless stated otherwise. MRP shown is the suggested retail price. We may change prices at any time; the price at the time of order confirmation applies.</p>
    <h2>4. Orders and payment</h2><p>Payments are processed securely by Razorpay. We offer (a) Prepaid — 100% of the order value paid online; and (b) Cash on Delivery — ${esc(s.cod_advance_pct)}% advance paid online, balance payable to the courier at delivery. An order is confirmed only after successful payment of the prepaid amount or the COD advance. We may cancel any order due to stock unavailability, pricing errors or suspected fraud, in which case any amount paid is refunded in full.</p>
    <h2>5. COD advance</h2><p>If a COD order is refused at delivery without a valid reason (such as a damaged parcel), the advance may be retained to cover forward and return shipping costs.</p>
    <h2>6. Shipping, returns and cancellation</h2><p>Governed by our <a href="/shipping-policy">Shipping Policy</a>, <a href="/refund-policy">Return &amp; Refund Policy</a> and <a href="/cancellation-policy">Cancellation Policy</a>, which form part of these terms.</p>
    <h2>7. Product information</h2><p>We try to display colours and details accurately; slight variations due to screens, dye lots and washes (e.g. acid wash) are normal and not defects.</p>
    <h2>8. Intellectual property</h2><p>All content, designs, logos and images on this site belong to ${esc(s.brand_name)}. Resellers may use our product photos to resell our products only.</p>
    <h2>9. Limitation of liability</h2><p>Our liability for any order is limited to the value of that order.</p>
    <h2>10. Governing law</h2><p>These terms are governed by the laws of India. Courts at ${esc(s.city)}, ${esc(s.state)} have exclusive jurisdiction.</p>
    <h2>11. Contact</h2><p>${esc(s.email)} · ${esc(s.phone)}</p>`),

  'privacy-policy': s => doc('Privacy Policy', UPDATED, `
    <p>${biz(s)} respects your privacy. This policy explains what we collect and how we use it, in line with India's Digital Personal Data Protection Act, 2023 and the IT Act, 2000.</p>
    <h2>What we collect</h2><ul><li>Mobile number (for OTP login and order updates)</li><li>Name, business name, GSTIN, email and delivery address</li><li>Order history</li><li>Payment status and reference IDs. Card/UPI/bank details are handled by Razorpay and are never stored on our servers.</li></ul>
    <h2>How we use it</h2><p>To process and deliver orders, send OTPs and order updates by SMS/WhatsApp, issue GST invoices, provide support, prevent fraud and meet legal obligations. With your consent we may send offers; you can opt out anytime.</p>
    <h2>Sharing</h2><p>We share only what is needed with payment processors (Razorpay), SMS providers, and courier partners. We never sell your data.</p>
    <h2>Cookies</h2><p>We use essential cookies to keep you logged in and your bag saved on your device.</p>
    <h2>Retention and your rights</h2><p>We keep order records as required by tax law (generally 8 years). You may request access, correction or deletion of your personal data by writing to ${esc(s.email)}.</p>
    <h2>Grievance officer</h2><p>${esc(s.legal_name)}, ${esc(s.email)}, ${esc(s.phone)}. We respond within 30 days.</p>`),

  'shipping-policy': s => doc('Shipping & Delivery Policy', UPDATED, `
    <h2>Coverage</h2><p>We ship across India through trusted courier partners and have delivered to ${esc(s.pincodes_delivered)}+ of ${esc(s.pincodes_total)} pin codes. Check your pin code on any product page.</p>
    <h2>Dispatch time</h2><p>Orders are packed and dispatched within 24–48 hours (excluding Sundays and public holidays) after payment or COD advance is received.</p>
    <h2>Delivery time</h2><ul><li>Metro cities: 3–5 working days</li><li>Rest of India: 5–8 working days</li><li>North-East, J&amp;K, islands and remote areas: 7–12 working days</li></ul>
    <h2>Shipping charges</h2><p>${+s.shipping_fee > 0 ? `A shipping fee of ₹${esc(s.shipping_fee)} applies${+s.free_ship_above > 0 ? `; free on orders above ₹${esc(s.free_ship_above)}` : ''}.` : 'Shipping is free on all orders.'}</p>
    <h2>Tracking</h2><p>You'll receive the courier name and AWB number by SMS/WhatsApp once shipped. You can also <a href="/track">track your order here</a>.</p>
    <h2>Cash on Delivery</h2><p>Pay the balance (${100 - +s.cod_advance_pct}% of the order value) to the courier in cash or UPI at delivery.</p>
    <h2>Damaged parcels</h2><p>Please do not accept a visibly tampered or damaged parcel. Record an unboxing video for every delivery — it is required for any claim.</p>`),

  'refund-policy': s => doc('Return, Exchange & Refund Policy', UPDATED, `
    <p>Because we sell at wholesale prices, returns are accepted only in the cases below.</p>
    <h2>Eligible</h2><ul><li>Manufacturing defect (e.g. stitching, fabric fault, print defect)</li><li>Wrong product, size or colour delivered</li><li>Missing pieces or damaged in transit</li></ul>
    <h2>How to raise a request</h2><p>Contact us on WhatsApp or email within <b>${esc(s.return_days)} days of delivery</b> with your order number, photos and a <b>continuous unboxing video</b> (from sealed parcel to opened). Items must be unused, unwashed and with tags.</p>
    <h2>Not eligible</h2><ul><li>Change of mind, size or colour preference, or slow sales</li><li>Slight colour variation or wash effects</li><li>Items used, washed, altered or printed on</li></ul>
    <h2>Resolution</h2><p>Approved requests are resolved by replacement. If a replacement is unavailable, we refund the value of the affected pieces.</p>
    <h2>Refund timelines</h2><p>Refunds are made to the original payment method via Razorpay within 5–7 working days of approval. Bank processing may take a few additional days.</p>`),

  'cancellation-policy': s => doc('Cancellation Policy', UPDATED, `
    <h2>By you</h2><p>You can cancel an order <b>before it is dispatched</b> by messaging us on WhatsApp or emailing ${esc(s.email)} with your order number. Prepaid amounts and COD advances for orders cancelled before dispatch are refunded in full to the original payment method within 5–7 working days.</p>
    <p>Orders cannot be cancelled once dispatched. Refusing a COD order at the doorstep counts as a cancellation after dispatch; the advance may be retained to cover shipping costs.</p>
    <h2>By us</h2><p>We may cancel an order if items are out of stock, a pricing error occurs, or the delivery pin code is not serviceable. You will receive a full refund in such cases.</p>`),
};

module.exports = { pages };
