import os
import threading
import tkinter as tk
from tkinter import filedialog

from kivy.app import App
from kivy.core.window import Window
from kivy.graphics import Color, Ellipse, Line
from kivy.metrics import dp
from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.widget import Widget
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.progressbar import ProgressBar


class CircleIcon(Widget):
    def __init__(self, color=(1, 1, 1, 1), text="", text_color=(0, 0, 0), opacity_val=1.0, **kwargs):
        super().__init__(**kwargs)
        self.color = color
        self.text = text
        self.text_color = text_color
        self.opacity_val = opacity_val
        self.size_hint = (None, None)
        self.size = (dp(80), dp(80))

        self.text_label = Label(
            text=self.text,
            color=self.text_color + (self.opacity_val,),
            size_hint=(None, None),
            size=self.size,
            halign='center',
            valign='middle'
        )
        self.text_label.bind(size=self.text_label.setter('text_size'))
        self.add_widget(self.text_label)

        self.bind(pos=self.update_graphics, size=self.update_graphics)

    def update_graphics(self, *args):
        self.canvas.clear()
        with self.canvas:
            Color(*self.color, self.opacity_val)
            d = min(self.size)
            Ellipse(pos=self.pos, size=(d, d))

        self.text_label.pos = self.pos
        self.text_label.size = self.size


class ProgressCircle(Widget):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.size_hint = (None, None)
        self.size = (dp(60), dp(60))
        self.current = 0
        self.total = 0
        self.bind(pos=self.update_graphics, size=self.update_graphics)

    def update_graphics(self, *args):
        self.canvas.clear()
        with self.canvas:
            Color(0.3, 0.3, 0.3, 1)
            Line(circle=(self.center_x, self.center_y, min(self.size) / 2), width=2)

            if self.total > 0:
                progress = self.current / self.total
                Color(0.2, 0.6, 1, 1)
                Line(circle=(self.center_x, self.center_y, min(self.size) / 2, 0, 360 * progress), width=3)

    def set_progress(self, current, total):
        self.current = current
        self.total = total
        self.update_graphics()


class DownloaderApp(App):
    def build(self):
        Window.size = (800, 600)
        self.title = "YouTube Downloader"

        main_layout = BoxLayout(orientation='vertical', padding=dp(20), spacing=dp(12))

        title_lbl = Label(
            text='YouTube Downloader',
            font_size=dp(28),
            size_hint_y=None,
            height=dp(50),
            color=(0.2, 0.2, 0.2, 1)
        )
        main_layout.add_widget(title_lbl)

        icons_layout = BoxLayout(size_hint_y=None, height=dp(120), spacing=dp(30))
        icons_layout.add_widget(Widget())

        # YouTube
        youtube_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(120))
        youtube_icon = CircleIcon(color=(1, 0, 0, 1), text="▶", text_color=(1, 1, 1), opacity_val=1.0)
        youtube_layout.add_widget(youtube_icon)
        youtube_layout.add_widget(Label(text='YouTube', size_hint_y=None, height=dp(30),
                                        color=(0.2, 0.2, 0.2, 1)))
        icons_layout.add_widget(youtube_layout)

        # Facebook
        facebook_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(120))
        facebook_icon = CircleIcon(color=(0.26, 0.4, 0.7, 1), text="f", text_color=(1, 1, 1), opacity_val=0.3)
        facebook_layout.add_widget(facebook_icon)
        facebook_layout.add_widget(Label(text='Facebook', size_hint_y=None, height=dp(30),
                                         color=(0.2, 0.2, 0.2, 0.3)))
        icons_layout.add_widget(facebook_layout)

        # Instagram
        instagram_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(120))
        instagram_icon = CircleIcon(color=(0.9, 0.4, 0.7, 1), text="📷", text_color=(1, 1, 1), opacity_val=0.3)
        instagram_layout.add_widget(instagram_icon)
        instagram_layout.add_widget(Label(text='Instagram', size_hint_y=None, height=dp(30),
                                          color=(0.2, 0.2, 0.2, 0.3)))
        icons_layout.add_widget(instagram_layout)

        icons_layout.add_widget(Widget())
        main_layout.add_widget(icons_layout)

        # Notes
        notes_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(80), spacing=dp(5))
        for note in [
            '📝 Put the links/URL in the input address below.',
            '📝 Only YouTube is available as of now.'
        ]:
            notes_layout.add_widget(Label(
                text=note,
                size_hint_y=None,
                height=dp(30),
                color=(0.6, 0.4, 0.0, 1),
                halign='left',
                valign='middle',
                text_size=(Window.width - dp(40), None)
            ))
        main_layout.add_widget(notes_layout)

        # URL input
        main_layout.add_widget(Label(text='Enter YouTube Video or Playlist Link', size_hint_y=None,
                                     height=dp(30), color=(0.2, 0.2, 0.2, 1),
                                     halign='left', valign='middle', text_size=(Window.width - dp(40), None)))
        self.url_input = TextInput(text='https://www.youtube.com/watch?v=example or https://www.youtube.com/playlist?list=exa',
                                   multiline=False, size_hint_y=None, height=dp(40),
                                   foreground_color=(0.5, 0.5, 0.5, 1))
        self.url_input.bind(focus=self.on_url_focus)
        main_layout.add_widget(self.url_input)

        main_layout.add_widget(Label(text='Supports single video or playlist links.', size_hint_y=None,
                                     height=dp(25), color=(0.4, 0.4, 0.4, 1), font_size=dp(12),
                                     halign='left', valign='middle', text_size=(Window.width - dp(40), None)))

        # Save location
        main_layout.add_widget(Label(text='Save Location', size_hint_y=None, height=dp(30),
                                     color=(0.2, 0.2, 0.2, 1),
                                     halign='left', valign='middle', text_size=(Window.width - dp(40), None)))
        location_layout = BoxLayout(size_hint_y=None, height=dp(40), spacing=dp(10))
        default_path = os.path.join(os.path.expanduser("~"), "Downloads")
        self.location_input = TextInput(text=default_path, multiline=False, size_hint_x=0.85)
        location_layout.add_widget(self.location_input)

        folder_button = Button(text='📁 Open', size_hint_x=0.15,
                               background_color=(0.8, 0.3, 0.3, 1))
        folder_button.bind(on_press=self.open_folder_dialog)
        location_layout.add_widget(folder_button)
        main_layout.add_widget(location_layout)

        main_layout.add_widget(Label(text="Default save location is your system's Downloads folder.",
                                     size_hint_y=None, height=dp(25),
                                     color=(0.4, 0.4, 0.4, 1), font_size=dp(12),
                                     halign='left', valign='middle', text_size=(Window.width - dp(40), None)))

        # Progress UI
        self.progress_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=0, spacing=dp(10))
        progress_top = BoxLayout(size_hint_y=None, height=dp(80), spacing=dp(20))
        progress_top.add_widget(Widget())
        self.progress_circle = ProgressCircle()
        progress_top.add_widget(self.progress_circle)

        progress_text_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(80))
        self.progress_count = Label(text='', font_size=dp(18), size_hint_y=None, height=dp(40),
                                    color=(0.2, 0.2, 0.2, 1))
        self.progress_status = Label(text='', font_size=dp(14), size_hint_y=None, height=dp(40),
                                     color=(0.4, 0.4, 0.4, 1))
        progress_text_layout.add_widget(self.progress_count)
        progress_text_layout.add_widget(self.progress_status)

        progress_top.add_widget(progress_text_layout)
        progress_top.add_widget(Widget())
        self.progress_layout.add_widget(progress_top)

        self.progress_bar = ProgressBar(max=100, value=0, size_hint_y=None, height=dp(20))
        self.progress_percentage = Label(text='', size_hint_y=None,
                                         height=dp(30), color=(0.2, 0.2, 0.2, 1))
        self.progress_layout.add_widget(self.progress_bar)
        self.progress_layout.add_widget(self.progress_percentage)
        main_layout.add_widget(self.progress_layout)

        # Download button
        self.download_button = Button(text='Download', size_hint_y=None, height=dp(50),
                                      background_color=(0.2, 0.6, 1, 1), font_size=dp(18))
        self.download_button.bind(on_press=self.start_download)
        main_layout.add_widget(self.download_button)
        main_layout.add_widget(Widget(size_hint_y=0.1))

        return main_layout

    def on_url_focus(self, instance, focused):
        placeholder = 'https://www.youtube.com/watch?v=example or https://www.youtube.com/playlist?list=exa'
        if focused and instance.text == placeholder:
            instance.text = ''
            instance.foreground_color = (0, 0, 0, 1)
        elif not focused and instance.text.strip() == '':
            instance.text = placeholder
            instance.foreground_color = (0.5, 0.5, 0.5, 1)

    def open_folder_dialog(self, instance):
        def choose():
            root = tk.Tk()
            root.withdraw()
            downloads = os.path.join(os.path.expanduser("~"), "Downloads")
            path = filedialog.askdirectory(title='Select Download Location', initialdir=downloads)
            if path:
                self.location_input.text = path
            root.destroy()
        thread = threading.Thread(target=choose, daemon=True)
        thread.start()

    def start_download(self, instance):
        url = self.url_input.text.strip()
        placeholder = 'https://www.youtube.com/watch?v=example or https://www.youtube.com/playlist?list=exa'
        if not url or url == placeholder:
            return

        is_playlist = 'playlist' in url.lower()
        self.download_button.text = 'Download All' if is_playlist else 'Download'
        self.progress_layout.height = dp(150)
        self.mock_download_process(is_playlist)

    def mock_download_process(self, is_playlist):
        total = 24 if is_playlist else 1
        self.progress_count.text = f'1/{total}'
        self.progress_status.text = 'Processing download...'
        self.progress_circle.set_progress(1, total)
        self.progress_bar.value = 0
        self.progress_percentage.text = '0%'

        def update(dt):
            if self.progress_bar.value < 100:
                self.progress_bar.value = min(self.progress_bar.value + 5, 100)
                self.progress_percentage.text = f'{int(self.progress_bar.value)}%'
                if self.progress_bar.value >= 100:
                    self.progress_status.text = 'Download completed!'
                    self.download_button.text = 'Download'
                    Clock.schedule_once(lambda _: setattr(self.progress_layout, 'height', 0), 2)
            else:
                return False

        Clock.schedule_interval(update, 0.1)


if __name__ == '__main__':
    DownloaderApp().run()
