import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function generateModels() {
  try {

    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found.');
    }

    // Ejecutar sequelize-auto
    const command = `sequelize-auto -o "./models" -d $RDS_DB_NAME -h $RDS_HOSTNAME -u $RDS_USERNAME -p $RDS_PORT -x $RDS_PASSWORD -e postgres`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      throw new Error(stderr);
    }

    console.log(stdout);
    console.log('Models generated successfully.');
  } catch (error) {
    console.error('Error generating models:', error);
  }
}

generateModels();
