import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { bootstrapTheme } from './composables/useTheme'

bootstrapTheme()
createApp(App).mount('#app')
