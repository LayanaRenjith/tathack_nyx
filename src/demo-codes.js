// Sample shops and QR payloads for trying Sahaaya. All UPI IDs are fictional.
// Print the QR codes with tools/print-qrs.html.

export const SAMPLE_SHOPS = [
  { name: 'Lakshmi Bakery', vpa: 'lakshmibakery@okaxis', usualAmount: 250 },
  { name: 'Sharma Medicals', vpa: 'sharmamedicals@okaxis', usualAmount: 500 },
];

export const DEMO_QRS = [
  {
    label: 'Lakshmi Bakery (real)',
    expect: 'Lakshmi Bakery, same account as always',
    text: 'upi://pay?pa=lakshmibakery@okaxis&pn=Lakshmi%20Bakery&mc=5462&cu=INR',
  },
  {
    label: 'Lakshmi Bakery (swapped sticker)',
    expect: 'stop: claims Lakshmi Bakery, pays another account',
    text: 'upi://pay?pa=lakshmi.bakery7@ybl&pn=Lakshmi%20Bakery&cu=INR',
  },
  {
    label: 'Swapped sticker with another name',
    expect: 'not one of your shops: pays Chhotu Tiwari',
    text: 'upi://pay?pa=chhotu.t99@ybl&pn=Chhotu%20Tiwari&cu=INR',
  },
  {
    label: 'Green Tea Stall (new shop)',
    expect: 'not one of your shops, not checked',
    text: 'upi://pay?pa=greenteastall@okicici&pn=Green%20Tea%20Stall&cu=INR',
  },
  {
    label: '"Scan to receive refund"',
    expect: 'stop: scanning always means you pay',
    text: 'upi://pay?pa=refund.helpdesk@paytm&pn=Refund%20Desk&am=4999&tn=Scan%20to%20receive%20your%20refund&cu=INR',
  },
  {
    label: 'Website link (not UPI)',
    expect: 'not a payment code',
    text: 'https://example.com/win-prize',
  },
];
