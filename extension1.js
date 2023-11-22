const vscode = require('vscode');
const puppeteer = require('puppeteer'); // 크로미움 브라우저를 자동제어하기 위해
let clip = require('copy-paste'); // vscode 에디터의 내용을 windows시스템 클립보드에 복사하기 위해


let canIGoNext = true; // 행번호 정열이 안되어 있으면, 브라우저를 여는 동작(Next)로 안 가도록 하기 위해 선언. 

// 행번호에 노란색 물결모양 밑줄을 긋기 위해 선언.  반드시, activate함수 밖에 선언해야 하므로 여기에 전역으로 선언했음.
const decorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'underline yellow wavy',
});


/**
 * @param {vscode.ExtensionContext} context
 */

// vscode의 정해진 규칙임.
function activate(context) {

	/*************************    copy text 명령 등록    **********************************************/
	let copyText_cmd = vscode.commands.registerCommand("basiccommandskim.copyText", function () {

		let editor = vscode.window.activeTextEditor;
		let copyedText = editor.document.getText();
		clip.copy(copyedText, () => {
			console.log("copying to clipboard succeeded!");
		});
		// vscode.window.showInformationMessage(copyedText)

	})


	/*********************    find wrong sorted line number 명령 등록    *******************************/
	let findwrongsortedlinenumber_cmd = vscode.commands.registerCommand('basiccommandskim.findwrongsortedlinenumber', () => {
        // 현재 active editor를 가져옵니다.
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }
		
		
        
        // Remove existing decorations

		editor.setDecorations(decorationType, []);
		
		const text = editor.document.getText();
		const lines = text.split('\n');
		const lineNumberArr = getRowNumbers(lines);

		// const options = {
		// 	modal: true,              // 모달 창으로 표시
		// 	detail: 'Additional info', // 세부 정보 표시
		// 	ignoreFocusOut: true       // 창 외부 클릭 무시
		// };
		
		const isSorted = isAscendingOrder(lineNumberArr);

		let misorderedRows;
				

		// Add underline to misordered rows
		if (!isSorted) {
			canIGoNext = false;
			
			misorderedRows = getMisorderedRows(lineNumberArr);
			
			
			const decorations = misorderedRows.map(rowNumber => ({
				range: new vscode.Range(rowNumber, 0, rowNumber, getLineNumberEndIndex(lines[rowNumber])),
			}));

			// Apply decorations
			editor.setDecorations(decorationType, decorations);
			
			misorderedRows = misorderedRows.map((i) => {return i+1})

			

			// 경고 모달창 띄우기
			vscode.window.showWarningMessage(
				'The line numbers are sorted incorrectly.',
				{
					modal: true,              // 모달 창으로 표시
					detail: `line number ${misorderedRows} are incorrect!`, // 세부 정보 표시
					
				},
				'show in message box'
			).then((selectedOption) => {
				if (selectedOption === 'show in message box') {
					// editor.setDecorations(decorationType, []);
					vscode.window.showInformationMessage(`line number ${misorderedRows} are incorrect!`);
				}
			});
		} else {
			canIGoNext = true;
		}
		
    });
	
	/* ***********************     MSX extention 명령 등록      ***********************************************/
	
	let browser;
	let page;
	let brWin;

	let openBr = vscode.commands.registerCommand('basiccommandskim.openBrowser', async () => {
		
		await vscode.commands.executeCommand('basiccommandskim.findwrongsortedlinenumber');
		if (!canIGoNext) {
			return
		}

		await vscode.commands.executeCommand('basiccommandskim.copyText');
		
		if (browser === undefined || browser.isConnected() === false) {

			

			/** 화면 width 알아내기 */
			browser = await puppeteer.launch({ headless: false, args: ['--start-maximized'] } );
			page = await browser.newPage();

			brWin = await page.evaluate(() => {
					return {w: window.outerWidth, h: window.outerHeight} // window에 빨간줄로 에러표시가 나나, 에러 안남. vscode에서는 window객체가 없어서, 에러로 표시되나, 이 공간에서는 크로미움 브라우저의 window객체를 사용할수 있게 해주는 puppeteer의 문법임.
				});
			vscode.window.showInformationMessage("outwidth:"+brWin.w + ", outheiht:" + brWin.h);
			await browser.close();


			/** 화면 오른쪽 절반에 크로미움 브라우저 열기  */
			const res_x = global.Math.floor(brWin.w/2)
			const win_pos = `--window-position=${res_x},0` 
			const win_size = `--window-size=${res_x+10},1300`
			browser = await puppeteer.launch({ headless: false ,args:[win_pos, win_size] } );
			
		
			/** 브라우저가 닫혔을 때의 동작 */
			browser.on('disconnected', () => {
				browser.close();
				vscode.window.showInformationMessage('browser closed!');
			 });


			/** 웹사이트 접속 */
			const webPageUrl = 'https://msxpen.com';
			let contentWidth;
			let contentHeight;

			page = await browser.newPage();
			
			/** 1920, 1040  해상도 종류
			  * 1536, 824
			  * 1366, 728
			  * 1280, 680  
			  * 1098, 578
			*/

			if (brWin.w < 1280){        // 해상도 1280 미만의 경우
				contentWidth = 320
				contentHeight = 578;
			} else if ( brWin.w <1366){ // 해상도 1280인경우
				contentWidth = 400;
				contentHeight = 680
			} else if ( brWin.w < 1536){// 해상도 1366인 경우
				contentWidth = 500;
				contentHeight = 728
			} else if ( brWin.w <1920){ // 해상도 1536인 경우
				contentWidth = 600;
				contentHeight = 824
			} else {                    // 해상도 1920인 경우
				contentWidth = 850;
				contentHeight = 1040
			}


			// 브라우저 윈도우 안의 실제사용가능한 view공간크기 설정. 위의 해상도에 따른 contentWidth, contentHeight로 설정.
			await page.setViewport({
				width: contentWidth, // 가로 해상도
				height: contentHeight, // 세로 해상도
			});
						
			try {

				// 웹 페이지 열기
				await page.goto(webPageUrl);

			} catch (error) {
				console.log(error, "cannot open msxpen.com");
			}

			/**
			 * machine 선택을 turboR로 자동화하려고 시도해봤으나 안됨.  누구 하실수 있는 분 가르쳐주세요.
			await page.waitForSelector('#wmsx-bar-settings');
			await page.click('#wmsx-bar-settings');
			await page.waitForSelector('#web-bar-menu-inner>div:nth-child(14)');
			await page.click('#web-bar-menu-inner>div:nth-child(14)');
			await page.waitForSelector('li:contains("MSX turbo R Japan (NTSC)")');
			await page.click('li:contains("MSX turbo R Japan (NTSC)")');
			 */

		} // endif

			// 마우스 왼쪽 클릭 (가상의 마우스 클릭)
			await page.waitForSelector('a[data-rb-event-key="asm"]');
			const basicButton = await page.$('a[data-rb-event-key="basic"]');
			const classes = await page.evaluate(button => button.className, basicButton);
			if (!classes.includes('active')) {
			  // 클래스에 'active'가 포함되어 있으면 클릭
				  await basicButton.click();
			}
			await page.click('a[data-rb-event-key="asm"]');
			await page.click('a[data-rb-event-key="basic"]');
	
			
			// Ctrl + A (msxpen 에디터의 모든 내용 선택)
			await page.keyboard.down('Control');
			await page.keyboard.press('A');
			await page.keyboard.up('Control');
	
			// Delete 키 (msxpen 에디터의 모든 내용 삭제)
			await page.keyboard.press('Delete');
	
			// Ctrl + V (msxpen 에디터에 windows클립보드의 내용 붙여넣기)
			await page.keyboard.down('Control');
			await page.keyboard.press('V');
			await page.keyboard.up('Control');
	
			await page.keyboard.down('Control');
			await page.keyboard.down('Alt');
			await page.keyboard.press('R');
			await page.keyboard.up('Control');
			await page.keyboard.up('Alt');
		
			// 에뮬레이터 탭 클릭
			await page.click('a[data-rb-event-key="emulator"]');

			// }
			
			// 작업 완료 후 브라우저 닫기
			// await browser.close();
		
	})// End of vscode.commands.registerCommand('basiccommandskim.openBrowser', ...)

	context.subscriptions.push(copyText_cmd, findwrongsortedlinenumber_cmd, copyText_cmd, openBr);
}



// =========================   행번호 정열을 위해 사용된 함수들   ==============================

function getLineNumberEndIndex(line) {
    // 행의 시작에 있는 숫자가 끝나는 인덱스를 찾는 함수
    const match = line.match(/^\s*(\d+)/);
    return match ? match[1].length : 0;
}

function getRowNumbers(lines) {
    // Extract row numbers from the beginning of each line
    return lines.map(line => {
        const match = line.match(/^\s*(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }).filter(rowNumber => rowNumber !== null);
}

function isAscendingOrder(arr) {
    // Check if an array is in ascending order
    if (getMisorderedRows(arr).length == 0) {
		return true;
	} else {
		return false;
	}
}

function getMisorderedRows(rowNumbers) {
    // Get indices of misordered rows
    const misorderedRows = [];
	let tmp = 0;
    for (let i = 1; i < rowNumbers.length; i++) {
		if (rowNumbers[i] == 0) { 
			if (rowNumbers[i-1] != 0){
				tmp = rowNumbers[i-1];
			} else {
				continue;
			}
		} else {
			if (rowNumbers[i-1] ==0) {
				if (rowNumbers[i] < tmp) { misorderedRows.push(i);}
			} else {
				if (rowNumbers[i] < rowNumbers[i - 1]) {misorderedRows.push(i);}
			}
		} 
    }
    return misorderedRows;
}


function deactivate() { }

module.exports = {
	activate,
	deactivate
}
