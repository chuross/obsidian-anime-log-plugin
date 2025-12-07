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
        contentEl.createEl('h2', { text: 'Select Anime Season' });

        const seasons = [
            { value: 'winter', label: 'Winter (1-3)' },
            { value: 'spring', label: 'Spring (4-6)' },
            { value: 'summer', label: 'Summer (7-9)' },
            { value: 'fall', label: 'Fall (10-12)' }
        ];

        // Determine current season default
        const currentMonth = new Date().getMonth() + 1;
        if (currentMonth >= 1 && currentMonth <= 3) this.season = 'winter';
        else if (currentMonth >= 4 && currentMonth <= 6) this.season = 'spring';
        else if (currentMonth >= 7 && currentMonth <= 9) this.season = 'summer';
        else this.season = 'fall';

        new Setting(contentEl)
            .setName('Year')
            .setDesc('Select the broadcast year (1990 - Next Year)')
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
            .setName('Season')
            .setDesc('Select the broadcast season')
            .addDropdown(dropdown => {
                seasons.forEach(s => dropdown.addOption(s.value, s.label));
                dropdown.setValue(this.season);
                dropdown.onChange(async (value) => {
                    this.season = value;
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Show Anime')
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
