import { createReadStream, writeFile } from 'node:fs';
import readline from 'node:readline';

async function readNonEmptyLines(filePath) {
  const fileStream = createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // учитывает различные окончания строк
  });

  const lines = [];

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0) {
      lines.push(trimmedLine);
    }
  }

  return lines.filter(l => l.startsWith("t."));
}



const tokens = await readNonEmptyLines("tokens.txt");

if(tokens.length === 0) {
  // работа с вводом выводом
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  const token = await askQuestion('Введите токен:');
  rl.close(); // !important
  tokens.push(token);
}

// вспомогательная функция обертка
const myFetch = (body, method, token) => {
  return fetch('https://invest-public-api.tinkoff.ru/rest/tinkoff.public.invest.api.contract.v1.' + method, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body
  });
}


async function loadDataForToken(token){
  // Получаем данные аккаунтов
  let requestBody = {
    'status': 'ACCOUNT_STATUS_UNSPECIFIED'
  };
  const resp = await myFetch(JSON.stringify(requestBody), 'UsersService/GetAccounts', token);
  const accs = await resp.json();

  // Получаем данные портфелей
  const portfolios = [];
  for (let account of accs.accounts) {
    requestBody = {
      "accountId": account.id,
      "currency": "RUB"
    };
    const resp = await myFetch(JSON.stringify(requestBody), 'OperationsService/GetPortfolio', token);
    const portfolio = await resp.json();
    portfolios.push(portfolio);

    // в портфель сохраняем список операций ввода вывода средств
    portfolio.operations = await getOperationsFor(account.id);
  }

  // функция получения операций ввода-вывода средств
  async function getOperationsFor(accountId) {
    const body = (cursor, accountId) => {
      return {
        "accountId": accountId,
        "cursor": cursor,
        "limit": 1000,
        "operationTypes": [
          "OPERATION_TYPE_INPUT", "OPERATION_TYPE_OUTPUT"
        ],
        "state": "OPERATION_STATE_EXECUTED"
      }
    }

    const operations = [];
    let cursor = ""
    let hasNext = true;
    do {
      const resp = await myFetch(JSON.stringify(body(cursor, accountId)), 'OperationsService/GetOperationsByCursor', token);
      const ops = await resp.json();
      operations.push(...ops.items);
      cursor = ops.cursor;
      hasNext = ops.hasNext;
    } while (hasNext);

    return operations.map(op => {return {
      currency: op.payment.currency,
      amount: +op.payment.units,
      dateStr: op.date,
      description: op.description
    }});
  }

  const result = {
    token_f10: "us_" + token.substring(0,10), // для удобства обновления портфеля
    accounts: accs.accounts,
    portfolios: portfolios
  }

  return result;
}


let data = [];
for (let token of tokens) {
  try{
    let result  = await loadDataForToken(token);
    data.push(result);
    console.log(`Данные получены для токена: ${token.substring(0,10)}`)
  } catch (e) {
    console.log(`Не удалось загрузить данные для токена: ${token.substring(0,10)}`)
  }
}

// Записываем результат в файл
const fileName = 't-calc-data.json';
writeFile(fileName, JSON.stringify({data: data},null, 2), 'utf8', () => {});

console.log(`Файл для создания/обновления портфеля(ей) в t-calc.ru: ${fileName}`);
