import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export const AIAutocompletion = Extension.create({
  name: 'aiAutocompletion',

  addOptions() {
    return {
      generateCompletion: () => Promise.resolve(''),
      debounceTime: 1000,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          class: {
            default: null,
            parseHTML: element => element.getAttribute('class'),
            renderHTML: attributes => {
              if (!attributes.class) return {}
              return { class: attributes.class }
            },
          },
          'data-prompt': {
            default: null,
            parseHTML: element => element.getAttribute('data-prompt'),
            renderHTML: attributes => {
              if (!attributes['data-prompt']) return {}
              return { 'data-prompt': attributes['data-prompt'] }
            },
          },
          'data-suggestion': {
            default: null,
            parseHTML: element => element.getAttribute('data-suggestion'),
            renderHTML: attributes => {
              if (!attributes['data-suggestion']) return {}
              return { 'data-suggestion': attributes['data-suggestion'] }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    let debounceTimer = null;
    let loading = false;

    return [
      new Plugin({
        key: new PluginKey('aiAutocompletion'),
        props: {
          handleKeyDown: (view, event) => {
            const { state, dispatch } = view
            const { selection } = state
            const { $head } = selection

            if ($head.parent.type.name !== 'paragraph') return false

            const node = $head.parent

            if (event.key === 'Tab') {
              if (!node.attrs['data-suggestion']) {
                // Generate completion
                if (loading) return true
                loading = true
                const prompt = node.textContent
                this.options.generateCompletion(prompt).then(suggestion => {
                  if (suggestion && suggestion.trim() !== '') {
                    dispatch(state.tr.setNodeMarkup($head.before(), null, {
                      ...node.attrs,
                      class: 'ai-autocompletion',
                      'data-prompt': prompt,
                      'data-suggestion': suggestion,
                    }))
                  }
                  // If suggestion is empty or null, do nothing
                }).finally(() => {
                  loading = false
                })
              } else {
                // Accept suggestion
                const suggestion = node.attrs['data-suggestion']
                dispatch(state.tr
                  .insertText(suggestion, $head.pos)
                  .setNodeMarkup($head.before(), null, {
                    ...node.attrs,
                    class: null,
                    'data-prompt': null,
                    'data-suggestion': null,
                  })
                )
              }
              return true
            } else {

              if (node.attrs['data-suggestion']) {
                // Reset suggestion on any other key press
                dispatch(state.tr.setNodeMarkup($head.before(), null, {
                  ...node.attrs,
                  class: null,
                  'data-prompt': null,
                  'data-suggestion': null,
                }))
              }

              // Set up debounce for AI generation
              if (this.options.debounceTime !== null) {
                clearTimeout(debounceTimer)
                
                // Capture current position
                const currentPos = $head.before()

                debounceTimer = setTimeout(() => {
                  const newState = view.state
                  const newNode = newState.doc.nodeAt(currentPos)
                  
                  // Check if the node still exists and is still a paragraph
                  if (newNode && newNode.type.name === 'paragraph') {
                    const prompt = newNode.textContent

                    if (prompt.trim() !== ''){
                      if (loading) return true
                      loading = true
                      this.options.generateCompletion(prompt).then(suggestion => {
                        if (suggestion && suggestion.trim() !== '') {
                          view.dispatch(newState.tr.setNodeMarkup(currentPos, null, {
                            ...newNode.attrs,
                            class: 'ai-autocompletion',
                            'data-prompt': prompt,
                            'data-suggestion': suggestion,
                          }))
                        }
                      }).finally(() => {
                        loading = false
                      })
                    }
                  }
                }, this.options.debounceTime)
              }
            }
            return false
          },
        },
      }),
    ]
  },
})