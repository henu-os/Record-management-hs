const { pdf } = require('pdf-to-img');
const fs = require('fs');

async function convertPdfs() {
  try {
    const docA4 = await pdf('scratch/test_voucher_a4_2perpage.pdf', { scale: 2 });
    let pageNum = 1;
    for await (const image of docA4) {
      fs.writeFileSync(`scratch/voucher_a4_page_${pageNum}.png`, image);
      console.log(`Saved scratch/voucher_a4_page_${pageNum}.png`);
      break;
    }

    const docLegal = await pdf('scratch/test_voucher_legal_3perpage.pdf', { scale: 2 });
    pageNum = 1;
    for await (const image of docLegal) {
      fs.writeFileSync(`scratch/voucher_legal_page_${pageNum}.png`, image);
      console.log(`Saved scratch/voucher_legal_page_${pageNum}.png`);
      break;
    }
  } catch (err) {
    console.log('Error converting pdf to img:', err.message);
  }
}

convertPdfs();
