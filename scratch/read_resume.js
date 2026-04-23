import fs from 'fs';
import pdf from 'pdf-parse';

const resumePath = "C:\\Users\\User\\Downloads\\Sunil_Khatate_SFDC_2026.pdf";

async function readResume() {
  try {
    const dataBuffer = fs.readFileSync(resumePath);
    const data = await pdf(dataBuffer);
    console.log('--- RESUME TEXT START ---');
    console.log(data.text);
    console.log('--- RESUME TEXT END ---');
  } catch (err) {
    console.error('Error reading PDF:', err.message);
  }
}

readResume();
