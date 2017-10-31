###
Render a single project entry, which goes in the list of projects
###

{React, rtypes, rclass}  = require('../smc-react')
{Button, Row, Col, Well} = require('react-bootstrap')
{Icon, Markdown, ProjectState, r_join, Space, TimeAgo} = require('../r_misc')
{User} = require('../users')
{AddCollaborators} = require('../collaborators/add-to-project')

exports.ProjectRow = rclass
    displayName : 'Projects-ProjectRow'

    propTypes :
        project : rtypes.object.isRequired
        index   : rtypes.number
        redux   : rtypes.object

    getDefaultProps: ->
        user_map : undefined

    getInitialState: ->
        add_collab: false

    render_status: ->
        state = @props.project.state?.state ? 'closed'
        if state?
            <a>
                <ProjectState state={state} />
            </a>

    render_last_edited: ->
        try
            <TimeAgo date={(new Date(@props.project.last_edited)).toISOString()} />
        catch e
            console.log("error setting time of project #{@props.project.project_id} to #{@props.project.last_edited} -- #{e}; please report to help@sagemath.com")

    render_user_list: ->
        other = ({account_id:account_id} for account_id,_ of @props.project.users)
        @props.redux.getStore('projects').sort_by_activity(other, @props.project.project_id)
        users = []
        for i in [0...other.length]
            users.push <User
                           key         = {other[i].account_id}
                           last_active = {other[i].last_active}
                           account_id  = {other[i].account_id}
                           user_map    = {@props.user_map} />
        return r_join(users)

    render_add_collab: ->
        if not @state.add_collab
            return
        # We get the immutable.js project object since that's what
        # the add collaborators object expects.   @props.project
        # should be immutable js, but that's not what we implemented
        # long ago, and I'm not fixing this now.  This won't result
        # in bad/stale data that matters, since when this object
        # changes, then @props.project changes.
        imm = @props.redux.getStore('projects').getIn(['project_map', @props.project.project_id])
        <AddCollaboratorsArea
            project = {imm}
            done    = {=>@setState(add_collab: false)}
        />

    render_collab_caret: ->
        if @state.add_collab
            icon = <Icon name='caret-down'/>
        else
            icon = <Icon name='caret-right'/>
        <span
            style = {fontSize:'15pt'}
            onClick={(e) => @setState(add_collab:not @state.add_collab); e.stopPropagation()}>
            {icon}
        </span>

    render_collab: ->
        <div>
            <div style={maxHeight: '7em', overflowY: 'auto'}>
                <a> {@render_collab_caret()} <Space/>
                    <Icon name='user' style={fontSize: '16pt', marginRight:'10px'}/>
                    {@render_user_list()}
                </a>
            </div>
            {@render_add_collab()}
        </div>

    render_project_title: ->
        <a>
            <Markdown value={@props.project.title} />
        </a>

    render_project_description: ->
        if @props.project.description != 'No Description'  # don't bother showing that default; it's clutter
            <Markdown value={@props.project.description} />

    handle_mouse_down: (e) ->
        @setState
            selection_at_last_mouse_down : window.getSelection().toString()

    handle_click: (e) ->
        if window.getSelection().toString() == @state.selection_at_last_mouse_down
            @open_project_from_list(e)

    open_project_from_list: (e) ->
        @actions('projects').open_project
            project_id : @props.project.project_id
            switch_to  : not(e.which == 2 or (e.ctrlKey or e.metaKey))
        e.preventDefault()

    open_project_settings: (e) ->
        @actions('projects').open_project
            project_id : @props.project.project_id
            switch_to  : not(e.which == 2 or (e.ctrlKey or e.metaKey))
            target     : 'settings'
        e.stopPropagation()

    open_add_collaborators: (e) ->
        @setState(add_collab:true)
        e.stopPropagation()

    render: ->
        project_row_styles =
            backgroundColor : if (@props.index % 2) then '#eee' else 'white'
            marginBottom    : 0
            cursor          : 'pointer'
            wordWrap        : 'break-word'

        <Well style={project_row_styles} onMouseDown={@handle_mouse_down}>
            <Row>
                <Col onClick={@handle_click} sm=2 style={fontWeight: 'bold', maxHeight: '7em', overflowY: 'auto'}>
                    {@render_project_title()}
                </Col>
                <Col onClick={@handle_click} sm=2 style={color: '#666', maxHeight: '7em', overflowY: 'auto'}>
                    {@render_last_edited()}
                </Col>
                <Col onClick={@handle_click} sm=2 style={color: '#666', maxHeight: '7em', overflowY: 'auto'}>
                    {@render_project_description()}
                </Col>
                <Col onClick={@open_add_collaborators} sm=4>
                    {@render_collab()}
                </Col>
                <Col sm=2 onClick={@open_project_settings}>
                    {@render_status()}
                </Col>
            </Row>
        </Well>


AddCollaboratorsArea = rclass
    propTypes: ->
        project : rtypes.immutable.Map.isRequired
        done    : rtypes.func.isRequired

    done: (e) ->
        @props.done()
        e.stopPropagation()

    render: ->
        <div>
            <h4>Add Collaborators</h4>
            <AddCollaborators
                project = {@props.project}
                inline  = {true}
            />
            <Button onClick={@done}>Close</Button>
        </div>

