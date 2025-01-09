
#/usr/bin/env bash

_example_completion() {
    local cur prev words cword
    _get_comp_words_by_ref -n : cur prev words cword

    # Get commands based on current context
    local commands=""
    case "$prev" in
        conditional-logging)
            ;;

        git)
            commands="add commit push"

        add)
            ;;

        commit)
            ;;

        push)
            ;;
            ;;

        docker)
            commands="build"

        build)
            ;;
            ;;
        *)
            commands="conditional-logging git docker"
            ;;
    esac

    if [[ "$cur" == -* ]]; then
        return 0
    fi

    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return 0
}

complete -F _example_completion example
