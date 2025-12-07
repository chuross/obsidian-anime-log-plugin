import { App, Modal, Setting } from 'obsidian';

export class YearSeasonModal extends Modal {
    year: number;
    season: string;
    onSubmit: (year: number, season: string) => void;
    onSearch: (query: string) => void;

    constructor(app: App, onSubmit: (year: number, season: string) => void, onSearch: (query: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.onSearch = onSearch;
        const currentYear = new Date().getFullYear();
        this.year = currentYear;
        this.season = ''; // Default: unspecified (年間)
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '放送時期を選択' });

        const seasons = [
            { value: '', label: '指定なし (年間)' },
            { value: 'winter', label: '冬 (1-3月)' },
            { value: 'spring', label: '春 (4-6月)' },
            { value: 'summer', label: '夏 (7-9月)' },
            { value: 'fall', label: '秋 (10-12月)' }
        ];

        // Search Section
        contentEl.createEl('h3', { text: 'キーワード検索' });
        let searchQuery = '';
        const searchSetting = new Setting(contentEl)
            .setName('アニメ検索')
            .setDesc('タイトルなどで検索できます')
            .addText(text => text
                .setPlaceholder('タイトルを入力...')
                .onChange(async (value) => {
                    searchQuery = value;
                }));

        searchSetting.addButton(btn => btn
            .setButtonText('検索')
            .onClick(() => {
                if (searchQuery) {
                    this.close();
                    this.onSearch(searchQuery);
                }
            }));

        contentEl.createEl('hr');
        contentEl.createEl('h3', { text: '放送時期から探す' });

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
