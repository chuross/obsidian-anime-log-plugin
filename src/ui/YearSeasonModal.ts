import { App, Modal, Setting } from 'obsidian';

export class YearSeasonModal extends Modal {
    year: number;
    season: string;
    onSubmit: (year: number, season: string) => void;

    constructor(app: App, onSubmit: (year: number, season: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        const currentYear = new Date().getFullYear();
        this.year = currentYear;
        this.season = 'spring'; // Default
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '放送時期を選択' });

        const seasons = [
            { value: 'winter', label: '冬 (1-3月)' },
            { value: 'spring', label: '春 (4-6月)' },
            { value: 'summer', label: '夏 (7-9月)' },
            { value: 'fall', label: '秋 (10-12月)' }
        ];

        // Determine current season default
        const currentMonth = new Date().getMonth() + 1;
        if (currentMonth >= 1 && currentMonth <= 3) this.season = 'winter';
        else if (currentMonth >= 4 && currentMonth <= 6) this.season = 'spring';
        else if (currentMonth >= 7 && currentMonth <= 9) this.season = 'summer';
        else this.season = 'fall';

        new Setting(contentEl)
            .setName('年')
            .setDesc('放送年を選択 (1990年〜)')
            .addDropdown(dropdown => {
                const currentYear = new Date().getFullYear();
                for (let y = currentYear + 1; y >= 1990; y--) {
                    dropdown.addOption(y.toString(), y.toString());
                }
                dropdown.setValue(this.year.toString());
                dropdown.onChange(async (value) => {
                    this.year = parseInt(value);
                });
            });

        new Setting(contentEl)
            .setName('季節')
            .setDesc('放送季節を選択')
            .addDropdown(dropdown => {
                seasons.forEach(s => dropdown.addOption(s.value, s.label));
                dropdown.setValue(this.season);
                dropdown.onChange(async (value) => {
                    this.season = value;
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('アニメを表示')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.year, this.season);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
