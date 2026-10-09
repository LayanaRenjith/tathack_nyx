// Demo QR payloads for testing and the stage demo. All UPI IDs are fictional.
// Print them as real QR codes with tools/print-qrs.html.

export const DEMO_QRS = [
  {
    label: 'Real shop: Sharma Medicals',
    expect: 'ok (when you say "Sharma Medicals")',
    text: 'upi://pay?pa=sharmamedicals@okaxis&pn=Sharma%20Medicals&mc=5912&cu=INR',
  },
  {
    label: 'FAKE sticker: Rahul K',
    expect: 'danger: name mismatch',
    text: 'upi://pay?pa=rahulk1998@ybl&pn=Rahul%20K&cu=INR',
  },
  {
    label: 'Scam: "scan to receive refund"',
    expect: 'danger: receive-money trick',
    text: 'upi://pay?pa=refund.helpdesk@paytm&pn=Refund%20Desk&am=4999&tn=Scan%20to%20receive%20your%20refund&cu=INR',
  },
  {
    label: 'Tea stall: Kumar Tea Stall',
    expect: 'ok / caution (personal account)',
    text: 'upi://pay?pa=9876543210@ybl&pn=Kumar%20Tea%20Stall&cu=INR',
  },
  {
    label: 'Not UPI: website link',
    expect: 'danger: not a payment code',
    text: 'https://example.com/win-prize',
  },
];
