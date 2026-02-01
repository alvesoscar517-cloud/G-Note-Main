import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'

const sections = [
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'description', label: 'Description of Service' },
  { id: 'account', label: 'Account Requirements' },
  { id: 'user-content', label: 'User Content' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'ai-features', label: 'AI Features and Credits' },
  { id: 'sharing', label: 'Sharing and Collaboration' },
  { id: 'data-storage', label: 'Data Storage and Backup' },
  { id: 'availability', label: 'Service Availability' },
  { id: 'intellectual-property', label: 'Intellectual Property' },
  { id: 'disclaimer', label: 'Disclaimer of Warranties' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'termination', label: 'Termination' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'contact', label: 'Contact Us' },
]

export function TermsOfService() {
  const navigate = useNavigate()
  const { initTheme } = useAppStore()
  const [activeSection, setActiveSection] = useState('acceptance')

  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id))
      const scrollPosition = window.scrollY + 120

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 80
      const elementPosition = element.offsetTop - offset
      window.scrollTo({ top: elementPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-6xl px-6 py-12 lg:px-12">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 mb-10 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex gap-16">
          {/* Sidebar */}
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <nav className="sticky top-12">
              <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">
                On this page
              </p>
              <div className="border-l border-neutral-200 dark:border-neutral-800">
                <ul className="space-y-0.5">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <button
                        onClick={() => scrollToSection(section.id)}
                        className={`block w-full text-left pl-4 py-1.5 text-[13px] transition-colors -ml-px border-l ${activeSection === section.id
                          ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                          : 'border-transparent text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                          }`}
                      >
                        {section.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <article>
              <h1 className="text-3xl font-semibold text-neutral-900 dark:text-white mb-1">Terms of Service</h1>
              <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-10">Last updated: December 27, 2024</p>

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
                <section id="acceptance" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">1. Acceptance of Terms</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    By accessing or using G-Note AI ("the Service"), available at gnoteai.com and as a Chrome extension, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
                  </p>
                </section>

                <section id="description" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">2. Description of Service</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    G-Note AI is a note-taking application that provides the following features:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Rich text note creation and editing with formatting options</li>
                    <li>Synchronization with Google Drive for cloud storage</li>
                    <li>Offline access and editing capabilities</li>
                    <li>Note sharing via public links, email, or real-time collaboration</li>
                    <li>AI-powered features including summarization, writing improvement, translation, and task extraction</li>
                    <li>Voice input for hands-free note creation</li>
                    <li>Drawing and image insertion</li>
                    <li>Import and export in multiple formats (PDF, Word, HTML, Markdown)</li>
                    <li>Version history and note restoration</li>
                    <li>Custom note styling with colors and backgrounds</li>
                  </ul>
                </section>

                <section id="account" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">3. Account Requirements</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    To use G-Note AI, you must:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Have a valid Google account</li>
                    <li>Grant G-Note AI permission to access your Google Drive for note storage</li>
                    <li>Be at least 13 years of age</li>
                    <li>Provide accurate and complete information</li>
                  </ul>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mt-4">
                    You are responsible for maintaining the security of your Google account and for all activities that occur under your account.
                  </p>
                </section>

                <section id="user-content" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">4. User Content</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    You retain all ownership rights to the content you create using G-Note AI. By using the Service, you grant us a limited license to process your content solely for the purpose of providing the Service features, including:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Storing and synchronizing notes with Google Drive</li>
                    <li>Processing content through AI features when requested</li>
                    <li>Displaying shared notes to authorized recipients</li>
                  </ul>
                </section>

                <section id="acceptable-use" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">5. Acceptable Use</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    You agree not to use G-Note AI to:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Store or share illegal, harmful, or offensive content</li>
                    <li>Violate any applicable laws or regulations</li>
                    <li>Infringe on the intellectual property rights of others</li>
                    <li>Distribute malware or engage in phishing activities</li>
                    <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
                    <li>Interfere with or disrupt the Service's operation</li>
                    <li>Use automated systems to access the Service without permission</li>
                  </ul>
                </section>

                <section id="ai-features" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">6. AI Features and Credits</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    AI-powered features may require credits for usage. By using AI features, you acknowledge that:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>AI-generated content is provided "as is" and may not always be accurate</li>
                    <li>You are responsible for reviewing and verifying AI-generated content</li>
                    <li>Credits are non-refundable once used</li>
                    <li>We reserve the right to modify credit pricing and packages</li>
                  </ul>
                </section>

                <section id="sharing" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">7. Sharing and Collaboration</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px] mb-4">
                    When you share notes:
                  </p>
                  <ul className="list-disc pl-5 text-neutral-600 dark:text-neutral-400 space-y-2 text-[15px]">
                    <li>Public links make your content accessible to anyone with the link</li>
                    <li>You are responsible for the content you share</li>
                    <li>Real-time collaboration requires all participants to have the room code</li>
                    <li>Email sharing uses Google Drive's sharing permissions</li>
                  </ul>
                </section>

                <section id="data-storage" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">8. Data Storage and Backup</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    Your notes are stored in your Google Drive account. While we provide offline caching for convenience, we recommend maintaining your own backups. We are not responsible for data loss due to Google Drive issues, account termination, or other circumstances beyond our control.
                  </p>
                </section>

                <section id="availability" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">9. Service Availability</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    We strive to maintain high availability but do not guarantee uninterrupted access to the Service. We may temporarily suspend the Service for maintenance, updates, or other operational reasons. We are not liable for any loss or damage resulting from service interruptions.
                  </p>
                </section>

                <section id="intellectual-property" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">10. Intellectual Property</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    G-Note AI, including its design, features, and code, is owned by G-Note AI Team. You may not copy, modify, distribute, or reverse engineer any part of the Service without our written permission. The G-Note AI name and logo are our trademarks.
                  </p>
                </section>

                <section id="disclaimer" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">11. Disclaimer of Warranties</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED. YOUR USE OF THE SERVICE IS AT YOUR OWN RISK.
                  </p>
                </section>

                <section id="liability" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">12. Limitation of Liability</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
                  </p>
                </section>

                <section id="termination" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">13. Termination</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    We reserve the right to suspend or terminate your access to the Service at any time for violation of these terms or for any other reason. You may stop using the Service at any time by logging out and revoking G-Note AI's access to your Google account.
                  </p>
                </section>

                <section id="changes" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">14. Changes to Terms</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    We may modify these Terms of Service at any time. We will notify users of significant changes by posting a notice on the Service. Your continued use of the Service after changes constitutes acceptance of the modified terms.
                  </p>
                </section>

                <section id="governing-law" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">15. Governing Law</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    These Terms of Service shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
                  </p>
                </section>

                <section id="contact" className="mb-12 scroll-mt-24">
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">16. Contact Us</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[15px]">
                    If you have any questions about these Terms of Service, please contact us at:{' '}
                    <a href="mailto:Support@graphoasai.com" className="text-neutral-900 dark:text-neutral-100 underline underline-offset-2">
                      Support@gnoteai.com
                    </a>
                  </p>
                </section>
              </div>
            </article>
          </main>
        </div>
      </div>
    </div>
  )
}
